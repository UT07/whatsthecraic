// src/pages/DJs.jsx
import React, { useState, useEffect } from 'react';
import djAPI from '../services/djAPI';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

const DJs = () => {
  const [djs, setDjs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDJ, setEditingDJ] = useState(null);

  const { register, handleSubmit, reset } = useForm();

  const fetchDJs = () => {
    djAPI.getAllDJs()
      .then(async (data) => {
        const enriched = await Promise.all(
          data.map(async (dj) => {
            try {
              const res = await fetch(`https://ec2-18-201-228-48.eu-west-1.compute.amazonaws.com/djs/${dj.dj_id}/fee-in-eur`);
              const response = await res.json();
              return {
                ...dj,
                converted_fee_eur: parseFloat(response.converted_amount_eur).toFixed(2)
              };
            } catch (err) {
              console.warn(`Conversion failed for DJ ${dj.dj_name}:`, err);
              return { ...dj, converted_fee_eur: null };
            }
          })
        );
        setDjs(enriched);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching DJs:", error);
        setLoading(false);
      });
  };
  

  useEffect(() => {
    fetchDJs();
  }, []);

  const openModal = (dj = null) => {
    setEditingDJ(dj);
    reset(dj || {}); // Pre-fill the form if editing
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditingDJ(null);
    setModalOpen(false);
  };

  const onSubmit = (formData) => {
    if (editingDJ) {
      // Update DJ
      djAPI.updateDJ(editingDJ.dj_id, formData)
        .then(() => {
          alert("DJ updated successfully");
          fetchDJs();
          closeModal();
        })
        .catch(error => {
          console.error("Error updating DJ:", error);
          alert("Failed to update DJ");
        });
    } else {
      // Add new DJ
      djAPI.addDJ(formData)
        .then(() => {
          alert("DJ added successfully");
          fetchDJs();
          closeModal();
        })
        .catch(error => {
          console.error("Error adding DJ:", error);
          alert("Failed to add DJ");
        });
    }
  };

  const handleDeleteDJ = (djId) => {
    if (window.confirm("Are you sure you want to delete this DJ?")) {
      djAPI.deleteDJ(djId)
        .then(() => {
          alert("DJ deleted successfully");
          fetchDJs();
        })
        .catch(error => {
          console.error("Error deleting DJ:", error);
          alert("Failed to delete DJ");
        });
    }
  };

  if (loading) return <p className="text-green-400">Loading DJs...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl">DJs</h1>
        <button 
          onClick={() => openModal()} 
          className="bg-green-500 px-4 py-2 rounded hover:bg-green-600"
        >
          Add DJ
        </button>
      </div>

      {/* Two-column responsive grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {djs.map(dj => (
          <motion.div
            key={dj.dj_id}
            className="bg-gray-800 p-4 rounded transform transition-all duration-300 hover:scale-105 flex flex-col"
          >
            <h2 className="text-xl mb-2">{dj.dj_name}</h2>
            <p><strong>Email:</strong> {dj.email}</p>
            <p><strong>Genres:</strong> {dj.genres}</p>
            <p><strong>Instagram:</strong> {dj.instagram}</p>
            <p><strong>SoundCloud:</strong> {dj.soundcloud}</p>
            <p><strong>City:</strong> {dj.city}</p>
            <p><strong>Phone:</strong> {dj.phone}</p>
            <p><strong>DJ Fee:</strong> {dj.dj_fee}</p>
            <p><strong>Currency:</strong> {dj.currency}</p>
            <p><strong>Numeric Fee:</strong> {dj.numeric_fee}</p>
            {dj.converted_fee_eur && (
              <p><strong>Fee in EUR:</strong> €{dj.converted_fee_eur}</p>
            )}

            <div className="flex space-x-2 mt-2">
              <button 
                onClick={() => openModal(dj)}
                className="bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
              >
                Edit
              </button>
              <button 
                onClick={() => handleDeleteDJ(dj.dj_id)}
                className="bg-red-500 px-3 py-1 rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal for Add/Edit DJ */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded w-11/12 max-w-md relative">
            <h2 className="text-2xl mb-4">{editingDJ ? 'Edit DJ' : 'Add DJ'}</h2>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-4">
                <label className="block mb-1">Name</label>
                <input type="text" {...register("dj_name", { required: true })} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Email</label>
                <input type="email" {...register("email", { required: true })} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Instagram</label>
                <input type="text" {...register("instagram")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Genres</label>
                <input type="text" {...register("genres")} placeholder="Comma separated" className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">SoundCloud</label>
                <textarea {...register("soundcloud")} className="w-full p-2 rounded bg-gray-800" rows="2" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">City</label>
                <input type="text" {...register("city")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Phone</label>
                <input type="text" {...register("phone")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Currency</label>
                <select {...register("currency")} className="w-full p-2 rounded bg-gray-800">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="INR">INR</option>
                  <option value="GBP">GBP</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1">Numeric Fee</label>
                <input type="number" step="0.01" {...register("numeric_fee")} className="w-full p-2 rounded bg-gray-800" />
              </div>

              <div className="flex justify-end space-x-2">
                <button type="button" onClick={closeModal} className="bg-gray-500 px-4 py-2 rounded hover:bg-gray-600">Cancel</button>
                <button type="submit" className="bg-green-500 px-4 py-2 rounded hover:bg-green-600">{editingDJ ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DJs;
