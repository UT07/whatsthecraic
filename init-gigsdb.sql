-- MySQL dump 10.13  Distrib 9.2.0, for macos15.2 (arm64)
--
-- Host: localhost    Database: gigsdb
-- ------------------------------------------------------
-- Server version	9.2.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `djs`
--
CREATE DATABASE IF NOT EXISTS gigsdb;
USE gigsdb;

DROP TABLE IF EXISTS `djs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `djs` (
  `dj_id` int NOT NULL AUTO_INCREMENT,
  `dj_name` varchar(255) DEFAULT NULL,
  `instagram` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `genres` varchar(255) DEFAULT NULL,
  `soundcloud` text,
  `city` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `dj_fee` varchar(50) DEFAULT NULL,
  `numeric_fee` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`dj_id`)
) ENGINE=InnoDB AUTO_INCREMENT=187 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `djs`
--

LOCK TABLES `djs` WRITE;
/*!40000 ALTER TABLE `djs` DISABLE KEYS */;
INSERT INTO `djs` VALUES (1,'ikigai3000','https://Instagram.com/ikigai3000.wav/','dylanjamesvideography@gmail.com','Schranz/Hard Techno/Hardgroove','https://soundcloud.com/ikigai3000','Drogheda','(+353)89-255-7501',NULL,50.00),(2,'Strukture','https://www.instagram.com/strukture_music/','lewisogilby1991@hotmail.com','Psy Techno, Melodic Techno, Techno, Progressive, Deep Trance ','https://on.soundcloud.com/XNsNV7i9sQonFfLd7','Larne ','‪+44 7517 937907‬',NULL,1000000.00),(3,'Fizzy','Fizzprod9','prodby.fizzy@gmail.com','Afrobeat/ Hiphop/ Dancehall/ House','Prod By Fizzy','Dublin','+353 830217246',NULL,100.00),(4,'Dj haze','Steel Dublin, dj 4 years, genres garage, breaks, dnb, jungle and techno ','danielh240499@hotmail.com','Dnb, jungle, garage, breaks, techo, trance ','','Dublin ','0892715653',NULL,150.00),(5,'Ksara','KSARA_music','KSARA.MUSIC@GMAIL.COM','HARD TECHNO, melodic techno, Hardgroove, Drum & Bass, Acid techno, ','https://on.soundcloud.com/a5uMwTHnFxgz24Fc8','Dublin','0831515463',NULL,100.00),(6,'Dj Gwada Mike ','https://instagram.com/karuk','djgwadamike@me.com','Reggae AfroHouse Amapiano ','https://on.soundcloud.com/qfdqFR1cf6wsEhuaA','Cork city ','+353862295950',NULL,500.00),(7,'KIRSTY','https://instagram.com/kirsty.dj?igshid=OGQ5ZDc2ODk2ZA%3D%3D&utm_source=qr','kirstyfallon22@gmail.com','Hard Techno, Hardstyle, Schranz, Industrial ','https://on.soundcloud.com/pJNBaTdjPSXNNhsL7','Galway','0838194851',NULL,200.00),(8,'RJ the DJ','https://instagram.com/rjthedjmw','bookingrjthedj@gmail.com',' Techno/ Afrobeats/Amapiano/ R&B/ HipHop/House(electro/afro/deep)','https://on.soundcloud.com/6KHVL4hcQw2EZeox6','Dublin','+353899640622',NULL,350.00),(9,'Curley','https://instagram.com/____curley____?igshid=OGQ5ZDc2ODk2ZA==','lcurley826@gmail.com','Hard Techno, Schranz Techno, Psytrance Techno, Hardgroove, Garage, House','https://on.soundcloud.com/G45Bc','Sligo','(+353) 87-446-7171',NULL,50.00),(10,'Ashanti Doran','https://instagram.com/ashantidoran?igshid=OGQ5ZDc2ODk2ZA%3D%3D&utm_source=qr','ashantidoran123@gmail.com','Hard techno or hard groove ','','Dublin','0834529299',NULL,60.00),(11,'Fizzy Waters','https://instagram.com/fizzy.waters?utm_source=qr','watersfizzy@gmail.com','Deep House, Progressive House , Minimal , Deep-Tech','https://on.soundcloud.com/FFkdKh773GBfd1DJ6','Dublin','+353838760446',NULL,50.00),(12,'CUITOL','https://www.instagram.com/acuitol/','betto-dom@hotmail.com','Dark Disco, Indie Dance, Melodic Techno, Organic House, House Disco, Disco House ','https://on.soundcloud.com/fYYjngBfegoHbV4z6','Dublin','087 87 780 8813',NULL,150.00),(13,'DJ Dacosta','https://instagram.com/deejaydacosta?igshid=OGQ5ZDc2ODk2ZA%3D%3D&utm_source=qr','dacostabookings@gmail.com','Afrobeats / Afrohouse/ Amapiano / Hip Hop / R&B / Dancehall / AfroTech / Pop / Dance / Kizomba','https://on.soundcloud.com/C8hS2fbtwswxHyB38','Dublin','+353899669667',NULL,400.00),(14,'Tech Noir','@ohbroin and @tom_mik80','conormattbyrne@gmail.com','Hard Techno, Dark Techno, Peak Time Techno','https://drive.google.com/drive/folders/1JJq_eRkijiYxWlf7jJ167ONR9u8JR8fx?usp=drive_link','Dublin','+353876360134',NULL,0.00),(15,'ALP BAGCI','https://www.instagram.com/v.alpbagci/?hl=en','v.alpbagci@gmail.com','Melodic Techno / Progressive House / Afro House / Techno','https://soundcloud.com/alp-bagci','Dublin','+353 87 487 6892',NULL,500.00),(16,'Mswenkocee ','https://www.instagram.com/mswenkocee/','mswenkocee7@gmail.com','Afrohouse/ afrotech','https://on.soundcloud.com/meqHrnRK9TzYsbfp8','Dublin','(+353) 89-254-4693',NULL,150.00),(17,'Lørex','https://www.instagram.com/lorex_dj?igshid=ODA1NTc5OTg5Nw==','lory_47@hotmail.it','Hard techno / Techno ','Check out Lorex_dj on #SoundCloud https://on.soundcloud.com/yVbjK','Dublin ','+353830235871',NULL,0.00),(18,'DJSMACKDADDY ','___djsmackdaddy___','conorjames2010@hotmail.com','Techno, hard dance','I don\'t have any recorded right now','Meath','0857010033',NULL,50.00),(19,'₦₳₮Ɇ','@nate_dj','nate.dj247@gmail.com','hard techno , industrial ','nathan walsh','mullin ','0830784884',NULL,0.00),(20,'SÜAVE ','@su.ave_','rbrady589@gmail.com','Trance hardgroove, hard techno ','https://on.soundcloud.com/LqmoTdjyVSPBMYQF9','Dublin ','+353874533394',NULL,70.00),(21,'CashuZ','https://www.instagram.com/cashuz?igshid=OGQ5ZDc2ODk2ZA==','a.philipowski@googlemail.com','Techno, Psytrance, Drum and Bass','Check out CashuZ on #SoundCloud https://on.soundcloud.com/n11PE','Dublin','(+353) 89-493-6770',NULL,50.00),(22,'Fran Ortu','https://www.instagram.com/francesco_ortu?igsh=MTNiYzNiMzkwZA%3D%3D&utm_source=qr','francesco.ortu2109@gmail.com','Techno, tech house','https://on.soundcloud.com/FTxomnQip3qzx4nb6','Kilcock','0857807687',NULL,150.00),(23,'Arzy.','https://instagram.com/arranfrielmurphy?igshid=NGVhN2U2NjQ0Yg%3D%3D&utm_source=qr','Arranmurphybcs@gmail.com','Hard Techno','https://on.soundcloud.com/Ag5v3rJ1LikYYJCP6','Dublin','0833946092',NULL,0.00),(24,'MO.','m0_679','naseerboxer14@icloud.com','Hard techno','','Westmeath ','0892642985',NULL,150.00),(25,'Maicon Wolf ','@maicon_wolf ','beernhousee@gmail.com','Tech House, House, Progressive Trance, Afro House','www.soundcloud.com/maicon-wolf ','Dublin ','0832028164',NULL,0.00),(26,'Skearney','Skearneyyy','kearneysean11@gmail.com','Bouncy Techno, Techno, Psytrance','https://on.soundcloud.com/89KWiC3i4ckKgNej6','Galway','+353 87 649 7525',NULL,300.00),(27,'Doiléir','https://www.instagram.com/doileir_dj?igsh=MXU3MjV1c3ZvNGZ6cQ%3D%3D&utm_source=qr','davidoneill.music@gmail.com','Techno, electro ','https://on.soundcloud.com/Nx73VnrXJdWdDuhx8','Cork','(+353)872776324',NULL,150.00),(28,'Supergross','https://www.instagram.com/supergross.ie/?hl=en','supergrossinfo@gmail.com','Techno, Ghettotech, Hardgroove, Electro, Garage','https://on.soundcloud.com/hXTHvPfybSvVYadPA','Galway','+353 858450177',NULL,150.00),(29,'Sullects','https://www.instagram.com/sullects_dj/','craigsullivan2001@gmail.com','Hard techno, Schranz','https://on.soundcloud.com/ivZs535HdwUajLNNA','Dublin','+353 852406252',NULL,50.00),(30,'Sofiii','https://www.instagram.com/sophia.bikova?igsh=MTl0Y241cHk0bnl3Mg==','sophiabikova16@gmail.com','Hypnotic / Dark / Berlin vibesssss','https://on.soundcloud.com/ZYhFk','Dublin','+353894907024',NULL,50.00),(31,'Iva Mechkarova','https://www.instagram.com/iva.mechkarova','ivamechkarova.dj@gmail.com','Hard Techno / Trance / Hypnotic Techno','https://soundcloud.com/iva-mechkarova','Dublin','+353833865945',NULL,100.00),(32,'MANC','Manc_techno ','sfrazer7734@mail.com','Dark techno, minimal techno, acid techno, Detroit techno (all 126-134 bpm range) Drum and Bass, Dubstep','','Dublin ','+353 89-266-1970',NULL,50.00),(33,'CRSRD','https://linktr.ee/crsrd?fbclid=PAAaaQ61fRy-mFOfi9Ev5XdO5Mrp91EqwnXGtz3uGn0N_TgHFchVeLtA-MZ48_aem_AfIQSrf39n3SjU784O6eyhSPLsiXs4EbmkolhkNHJRKLFW8Q6t0Ihv3Vjsfm37CqFzw','jordynm249@gmail.com','Melodic Techno, Acid Techno, Trance, Hard Techno','https://on.soundcloud.com/3MueE7W7SNSMEf4a7','Portarlington','0830166383',NULL,250.00),(34,'Brenno','https://campsite.to/brenno?fbclid=PAAaZTIuQAh3Dg1ajrGQQ9BYcHP2Uee8y_uIIS_SgvjvZWpyvuS24x2xALf1g_aem_AZdcbdGdnur0jH5rU80QxDRapR5AA25VEZJC4FENbrPnBcCeOri6pQBhhMW0r5gmS8w','jbrennomusic@gmail.com','Hard Techno / Techno','https://on.soundcloud.com/yFVCwpxq9yb9C25X6','Dublin','0838700065',NULL,80.00),(35,'Phantom ','https://www.instagram.com/kacper_zeberek/','zeberekkacper35@gmail.com','Melodic Techno/ Peak Time/ Progressive House ','','Navan','(+353)0873910835',NULL,100.00),(36,'D-JAYY','Jayysoniii','jaysoni8478@gmail.com','Dance/ electronic ','','Dublin ','0896181005',NULL,200.00),(37,'Jaz. ','https://www.instagram.com/_jaz1111?igsh=ZGNjOWZkYTE3MQ%3D%3D&utm_source=qr','jm68@live.ie','Techno, Hardtechno, Trance, Psytrance, Gabber, Makina. ','https://on.soundcloud.com/Xeoy6MJPLV9eFFpz5','Carlow','0857624023',NULL,50.00),(38,'Fatuler','https://linktr.ee/alexandrufatul?fbclid=PAAab0__sy2l0iRkpXIzOWhiRbUnIVks-EOkRjBFMgx3k9cccBGJIOd2TxaAk_aem_Ae6Z59KhyNSFZPP6duQmdZP0jVncsn7D-cp5r6ayfqupyJiiarlzIq6rxsPiQAKzPZs','alexandrufatul@gmail.com','Hard groove/ Hard techno ','https://on.soundcloud.com/McWes5FHM5AYAPk9A','Dublin ','0897082755',NULL,70.00),(39,'R2','instagram.com/arthvrbraga','arthvrbraga@gmail.com','Raw-hypnotic techno/hardgroove/hard techno','http://soundcloud.com/r2-advncd','Dublin','(+353) 83-381-1661',NULL,0.00),(40,'2M','https://www.instagram.com/mattew_mondo?igsh=MThvcmJ6NGlhNnJnbg==','matteo.musa91@gmail.com','Techno underground ',' https://on.soundcloud.com/m6BHq','Dublin ','+353830705994',NULL,0.00),(41,'Herbrido ','https://www.instagram.com/herbrido?igsh=MmZycHo5NnhqbWRn&utm_source=qr','dj.herbrido@gmail.com','Peak Time Techno, Hardtechno','https://on.soundcloud.com/BqszPo1as35FR3L68','Stuttgart ','4.91786E+11',NULL,150.00),(42,'Jelackee','https://www.instagram.com/jelaca_nikola4?igsh=bHdwbGR3dHQ1OGNn','nikolajelaca50@gmail.com','Hard Techno','https://on.soundcloud.com/z855NVzCZG7PnMqB6','Novi Sad','‪+353 87 051 7204‬ Only wa',NULL,200.00),(43,'Biteslice ','https://www.instagram.com/biteslice_?igsh=c3QzdHdyMjFqN2Ex&utm_source=qr','scanlanchloelouise@gmail.com','Drum and Bass. Tech House. Trashy Techno','https://on.soundcloud.com/52Z3p','Dublin ','0863942500',NULL,50.00),(44,'Databassdevi ','https://www.instagram.com/databassdevi?igsh=cXhqMmgyZDZiejEy','sakshid878@gmail.com','Drum and bass\r\nHard techno X psychedelic\r\nAcid / Electro / jump up / bootleg / garage\r\nDubstep / grime / DNB / jungle\r\n','Check out Databass devi on #SoundCloud https://on.soundcloud.com/2wBxn','Dublin ','+353 892716693',NULL,300.00),(45,' The Menace ','@dez_the_menace ','dewijones44@hotmail.co.uk','UK Hard dance, Powerstomp, Reverse bass, Hardstyle, Uptempo, Rawstyle, Hard Bounce, Happy Hardcore, Hardcore, Donk, Oldskool hardcore, Hardpsy, UK makina, Hard trance, Hard techno, Hard house ','The Menace ','Dublin ','+353 (89) 987 2940',NULL,100.00),(46,'Ambit','https://www.instagram.com/ambit.dj/','ambitdj.sub@gmail.com','DnB/ Jungle /Dubstep','https://soundcloud.com/ambitdj','Dublin','0876939330',NULL,50.00),(47,'SACK','https://www.instagram.com/sack.ar','sack.nahuel@gmail.com','Progressive House / Melodic House / Indie Dance / ','https://soundcloud.com/sack_ar','Barcelona','+34608756032',NULL,0.00),(48,'Sanie Bega','https://www.instagram.com/saniebega?igsh=NGc5bmRld2hwZmd0&utm_source=qr','sanieb88@gmail.com','HARD TECHNO/SCHRANZ/ACID TECHNO','https://on.soundcloud.com/9kFU5SYNenUHdNKt5','Galway','0833004637',NULL,150.00),(49,'Glizzy ','https://www.instagram.com/glizzy.dnb?igsh=MWZhMzByM29qdWZ6bQ==','glizzydnb@gmail.com','Drum and Bass, Dubstep','https://on.soundcloud.com/CPHej','Dublin ','0831173608',NULL,80.00),(50,'Elicit ','@elicitdublin','elissa.odowd@yahoo.ie','Dnb-rollers, jungle, liquid, jump up \r\nBreaks\r\nGarage\r\nTechno','','Dublin ','0872041873',NULL,100.00),(51,'Deip music','https://www.instagram.com/deip_musicc?igsh=MW45ZzRrbW9uaW4zbQ%3D%3D&utm_source=qr','longhipierluigi@gmail.com','Progressive House, Melodic techno, ','https://on.soundcloud.com/LrUY9a4MZJPEr3MH6','Valencia','+34 699 701 110',NULL,300.00),(52,'Anspect','https://instagram.com/anspect.music','anspect.music@gmail.com','Melodic Techno / Techno / Progressive House','https://soundcloud.com/anspect','Lyon / Saint Etienne','+33614786550',NULL,500.00),(53,'angel tabris','@angeltabris','angeltabris303@gmail.com','jungle/dnb/ukg/dubstep/bassline','https://on.soundcloud.com/6AnjN','Dublin','0851796003',NULL,60.00),(54,'MɅRKO','https://www.instagram.com/wav.marko/','markus.daugavietes@gmail.com','Groove/ Hard Groove/ Hard Techno / Industrial','https://l.instagram.com/?u=https%3A%2F%2Fon.soundcloud.com%2FyQeR9eUNPvDS867C7%3Ffbclid%3DPAAaZ0KnJtdY5fKwxnuW-kD_gNuImpOECFO1DjyUmWO1e8t9YqlRcZ4QMeJMk_aem_ARnZlSQb1aHfCqlx1G0wQxIhigitveGAvnxoKM6AkECFfPWKvnzS_BTtV-4YBeR7MVk&e=AT3tUitdHNOZDVkIchl6rYKR1a0iT1x3AaZBZANW-1JzWUzDgIxBOrDG7DGjRiy6NG1NQqHALy7CDzUBVDy0lwnaKirT75jjU66s3w','Dublin / Newry','+353 89 428 5170',NULL,0.00),(55,'FM_ALTO','https://www.instagram.com/fm_alto?igsh=N3RxeTN2bzBpMHBk','colemanalan60@gmail.com','Amapiano/Afrohouse/Breakbeat/Garage/Afrobeat/Highlife/Dubstep','https://www.mixcloud.com/FM_ALTO/','Dublin','00353872180920',NULL,200.00),(56,'Gerard Bozyk ','https://www.instagram.com/gerardbozykdj?igsh=dGQ3YndlY3p0MGgz','gerardbozykk@gmail.com','Progressive house, melodic house, deep house ','https://on.soundcloud.com/u68PS','Ireland ','858318732',NULL,50.00),(57,'Algorithmix ','https://instagram.com/algorithmix','adamwakefield1@gmail.com','Psytrance/ DnB','https://on.soundcloud.com/djalgorithmix','Dublin ','(+353)830109282',NULL,50.00),(58,'Arcanne','Instagram.com/arcannemusic','arcannebookings@gmail.com','Psy-trance, Tech-house, Bass-house','Soundcloud.com/arcanne','Dublin','838035317',NULL,100.00),(59,'Mav','https://www.instagram.com/djmavofficial','djmavmc@gmail.com','Techno, dark techno, industrial techno, acid techno, tech house','https://www.mixcloud.com/djmav/','Dublin','+353 83 408 1962',NULL,200.00),(60,'Teri Makasih ','@teri_makasih_official','teri.makasih.official727@gmail.com','Industrial Techno, Hard Techno, Neo Rave, Hardcore, Hardstyle, Schranz ','https://on.soundcloud.com/DmMto','Madrid ','+34 646873991',NULL,500.00),(61,'Ben Vincent','https://www.instagram.com/benvincent_music/','benvincentmusic@gmail.com','Tech House / Techno / Melodic Techno / House / Jakin / Disco / DNB','https://soundcloud.com/benvincentmusic','Sydney','+61 452 609 924',NULL,50.00),(62,'Katoff','Instagram.com/djkatoff','booking@katoff.net','Melodic House and Techno, Techno (Peaktime), Progressive House, Trance','soundcloud.com/djkatiff','Burnley ','+44 7564310855',NULL,500.00),(63,'psalm.','https://www.instagram.com/psalm_lvl?igsh=Y2JweWJrbnczOHpz&utm_source=qr','dj.psalm.lvl@gmail.com','Hard Groove, Hard Techno, Dance/Electronic, House','https://on.soundcloud.com/FjGPxiYYFq9XiREt9','Dublin','+353 858341950',NULL,50.00),(64,'GALLACHÓIR ','HTTP://WWW.INSTAGRAM.COM/GALLACHOIR.DJ','gavingallagher99@gmail.com','House, techno (melodic techno  to hard techno) dnb, psytrance and more','GALLACHÓIR.dj','Dublin ','085 211 6597',NULL,100.00),(65,'Pedro V official ','https://www.instagram.com/pedro.v.official?igsh=MTJmaGRqZmdrcXl1Zg==','peterkphotography@hotmail.com','Melodic  progressive techno','https://on.soundcloud.com/1mHz2','Dublin ','00353879097806',NULL,0.00),(66,'Leslie Goldfinder','https://www.instagram.com/iam_leslie_goldfinder','lesliegoldfinder@live.com','AfroTech/ afrohouse / 3step / Deep house ','https://hearthis.at/leslie-godfinder/','Limerick ','+353 83 431 5748',NULL,350.00),(67,'Sémaé','semae_y.m','maeva.yrio@icloud.com','Trance, Melodic Techno, hard techno, hard trance, Afro house ','https://on.soundcloud.com/oy6mYqBQqQBwrxob7','Dublin','+353871845597',NULL,100.00),(68,'Junki','https://www.instagram.com/hardjunki/','marcjuncabusiness@gmail.com','Techno / Hardgroove / Hardtechno / … many other genres','https://m.soundcloud.com/dj-junki','Barcelona','+34 673547939',NULL,1.00),(69,'DoR','@dorirl83','dormusicoffical@gmail.com','Techno /tech house /house ','','Limerick ','0838064128',NULL,250.00),(70,'Carol DOP','Https://www.instagram.com/carol.dop','caroldopmusic@gmail.com','Tech House And Afro House','https://on.soundcloud.com/nvLnnPwgcnGiEQT76','Barcelona','0034653154019',NULL,100.00),(71,'Leonardo Biagini','https://www.instagram.com/leonardobiagini_theageoflove?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==','biaginileonardo@yahoo.it','Progressive techno, Melodic techno, Detroit and Classic House, Funky and Indie Dance','https://soundcloud.com/the-age-of-love-143650095?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing','Dublin','0830958833',NULL,100.00),(72,'Arweenn','https://www.instagram.com/arweenn_alderic_/?hl=en','aldericrecords@gmail.com','Techno/Hardtechno','','Sicily ','+39 3347055797',NULL,1000.00),(73,'TRISTAN WM','https://www.instagram.com/tristan__wm','tristanwattersm@gmail.com','Hard techno hard groove','https://soundcloud.com/user-778996601-998757432?ref=clipboard&p=i&c=1&si=9C816F3D77A547C5A640B33E8B080609&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing','Wexford','0894695179',NULL,0.00),(74,'COG','https://www.instagram.com/c__o___g?igsh=MXNvN2ppeWcyeGd5bw%3D%3D&utm_source=qr','chrisogalligan1@gmail.com','Garage,ukg,speed garage, breaks,bass ,techno,hardgroove, trance ','cog /// incognito ','Cork city ','083 806 5638',NULL,100.00),(75,'C:P','conorsmith3931','conorsmith221107@gmail.com','Techno,House,Techhouse,Melodic Techno,Trance','CP','Meath','+353 87 338 2866',NULL,50.00),(76,'JUST_IVA','https://www.instagram.com/just_iva?igsh=dmVmNzlkbGFidnA%3D&utm_source=qr','grkinic.iva@gmail.com','Progressive house, techno, tech-house, funk & disco','https://on.soundcloud.com/JSZGqZfnNvqyyGH17','Dubli ','+353834883191',NULL,70.00),(77,'Jack Sheehy','instagram.com/_jacksheehy','jacksheehy14@gmail.com','Melodic Techno, House, Techno','','Dingle ','+353838968685',NULL,100.00),(78,'Ste Flynn ','https://www.instagram.com/steflynnirl/?hl=en','info@steflynn.ie','Progressive House / Melodic House / Melodic Techno ','https://soundcloud.com/steflynnirl','Dublin ','087 298 6941',NULL,100.00),(79,'Frame Shift','https://www.instagram.com/frame_shift_rob/','frame.shift.rob@gmail.com','D&B/UK Garage/Breaks/Techno/House','https://soundcloud.com/frame_shift','Dublin','+353863426511',NULL,100.00),(80,'Streight','https://www.instagram.com/streight_','officialstreight@gmail.com','House, techno, Drum and Bass','https://on.soundcloud.com/YYeXVTDfhY18CGhU6','Dublin','0874875313',NULL,0.00),(81,'Tsara','tsara_abh','peacemoremagonya@gmail.com','Afro House/ Afro Tech / Amapiano ','https://on.soundcloud.com/brJ958iHUcfx7bhG6','Drogheda ','(+353) 83 072 3493',NULL,200.00),(82,'Marks','https://www.instagram.com/shamack_djmarks/','zadzis@gmail.com','Techno, Deep ','https://soundcloud.com/marks-techno','Dublin','0831267167',NULL,0.00),(83,'ARIANA','https://www.instagram.com/ariana.djay/','dagostiniariane@gmail.com','Melodic techno, progressive House, Afro House, tech house ','https://on.soundcloud.com/RzFz6zx2ECXSduup9','Dublin','+353 83 1047590',NULL,50.00),(84,'CnC ','CnC.music ','cnc.music.djs@gmail.com','Melodic house & techno & techno ','','Dublin','0871787341',NULL,300.00),(85,'Just After Midnight','https://www.instagram.com/justaftermidnight/','nocturnaldublin@gmail.com','Hard Groove , Techno , Psytrance , Breakbeat,','https://soundcloud.com/just-after-midnight-592953019/sets/guest-mixes/s-ywQuTPveolO?','Dublin','(+353) 86-162-2677',NULL,100.00),(86,'The Dirtbirdz ','https://www.instagram.com/thedirtbirdz/','ianball@live.ie','Techno, hardgroove, melodic techno,house ','https://soundcloud.com/dirtbirdz','Dublin','0852883524',NULL,200.00),(87,'Favio Inker ','https://www.instagram.com/favioinker?igsh=MXkyaHliZHdpYWMwbA%3D%3D&utm_source=qr','inkerfavio@gmail.com','Indie Dance / Melodic Techno ','https://on.soundcloud.com/GAiwwr3u9h2XfkQz8','Dublín ','+5491162207774',NULL,500.00),(88,'Daphna ','https://www.instagram.com/daphna.music?igsh=engwNHVoMnN6dmRu','dafnesol@gmail.com','Progressive house/ indie dance/ Afro house/ tech house','https://soundcloud.com/daphnamusic/set-daphna/s-75o1QF0soDu?si=a91ffd3d1a604cfbb41c8b891bd562e2&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing','Barcelona ','+34607817148',NULL,300.00),(89,'Dj Nollkoll ','https://www.instagram.com/dj_nollkoll?igsh=MWgyZmVpbm52MGwwbw==','djnollkoll@swedenmail.com','Psytrance fullon ','https://on.soundcloud.com/PvUgz','Gothenburg ','+46763281441',NULL,0.00),(90,'fogosjoking','finn.fogarty','finnfogarty11@gmail.com','techno, hardgroove, raw/deep/hypnotic techno, hard techno','https://on.soundcloud.com/TDdeWXmxjXtXYNtF8','greystones, wicklow','0852289740',NULL,0.00),(91,'Benja Millan','https://www.instagram.com/benjamillan/','benja.baleztena@gmail.com','Techno peak time, melodic techno , psy trance , progressive house ','https://www.youtube.com/watch?v=YVgRaVLkvTY&t=62s&ab_channel=BenjaminMillan','Barcelona','+34 674 78 97 24',NULL,250.00),(92,'NAZARENO','@nazarenodj','nazarenomm99@gmail.com','Indie Dance / Melodic House / Progressive house / Afro House / Tech House / Melodic Techno / Downtempo / ','https://on.soundcloud.com/QmX5PMvouErK7jAVA','Dublin ','0874097112',NULL,100.00),(93,'TOBEz','@tobezdj','TOBEzDJ@outlook.com','Drum and bass','https://on.soundcloud.com/wyh8bLYc2nG5tpBU7','Galway','0892299336',NULL,100.00),(94,'Molothav','https://www.instagram.com/molothav/','molothav@gmail.com','Techno Peak Time','https://on.soundcloud.com/N6SeDesAHqoPaor7A','São Paulo ','+5512981080930',NULL,350.00),(95,'Lindani Alex ','@lindani Alex ','raymondkefeletswe2055@gmail.com','Amapiano, deep house and Afro music ','YouTube is lindani Alex ','Dublin','+353894331267',NULL,50.00),(96,'Plastic','https://www.instagram.com/olibch?igsh=MXJ5amRlbWR5YmVwZQ%3D%3D&utm_source=qr','Oliver.Becher@gmail.com','Dark techno / drive techno / melodic techno / Afro house','https://on.soundcloud.com/g9tz1okGf3y58rE56','Dublin','+353 89 210 2819',NULL,500.00),(97,'Keith Burke / Burkey','https://www.instagram.com/keithburkedj?igsh=MWVkbWoyNnFlcm43eg%3D%3D&utm_source=qr','burkeycha2015@gmail.com','Melodic Techno / Techno / Progressive House / House / Melodic House','https://on.soundcloud.com/u4x9Ld7gX7GZiHDw9','Dublin','(+353) 851968866',NULL,150.00),(98,'Mark Lennon ','https://www.instagram.com/marklennon_official/?hl=en','lennonmark50@gmail.com','Melodic House & Techno / House/Tech House','https://on.soundcloud.com/gHfNp','Dublin','3.53851E+11',NULL,150.00),(99,'AM.','Alex.mooney9','alexmoo4000@gmail.com','Hypnotic groove/drum and bass/progressive techno ','https://on.soundcloud.com/hUZfscojYrvPn3X68','Dublin','(+353) 87 465 3177',NULL,1.00),(100,'Berkay Vagas','https://www.instagram.com/berkayvagas?igsh=MW5yeDZmamVzbWZvbw==','berkayvagas@gmail.com','House, afro house, organic, tech house, progressive house, melodic house, techno, hard techno','www.soundcloud.com/berkayvagas','Dublin','(+353) 87-489-9870',NULL,0.00),(101,'Claire Nøir','https://www.instagram.com/_clairenoir_?igsh=dHhxYXo4N2ZwM2lh&utm_source=qr','Clairenoir11@gmail.com','Hard techno','https://on.soundcloud.com/AuAiZ6e5j8bMjuY46','Prague','+420608195592',NULL,300.00),(102,'Bom Bruise','https://www.instagram.com/bom.bruise?igsh=MXN3ejc5anZqZWwxdQ%3D%3D&utm_source=qr','lucusmooney@hotmail.com','Hard techno/trance, techno, hardgroove, house','https://on.soundcloud.com/JbfEwcbc3HrkJAe17','Dublin','+353 85 824 2930',NULL,50.00),(103,'Nicole Spagnol','https://www.instagram.com/nicole_spagnol/','nicolespagnol@hotmail.com','Tech House / House / Minimal Deep Tech','https://soundcloud.com/nicolespagnol-msc','Dublin','0832063995',NULL,100.00),(104,'Lorhana Pires','lorhanapires','lorhanapiresdj@gmail.com','Tech House / Melodic / Afrohouse ','','Dublin ','0832097069',NULL,250.00),(105,'yeahhbuzz','https://www.instagram.com/yeahhbuzz','yeahhbuzz@gmail.com','160 / rave / techno / donk / bass / footwork','SoundCloud.com/Yeahhbuzz ','dublin','+353852075303',NULL,200.00),(106,'DiLLO','@dylannobyrne','dillobyrne@gmail.com','Hardgroove, techno, Speed Garage ','','Kilkenny ','0863338033',NULL,200.00),(107,'MDMA','https://www.instagram.com/mdmamusicbr','mdmamusicbr@gmail.com','TECHNO/ HOUSE / ACID ','http://soundcloud.com/mmddmmaa','São Paulo','+5511976765577',NULL,0.00),(108,'YPF','@itsmeypf','cgcg0006@mail2.doshisha.ac.jp','Hard industrial/Schranz/Hard Core','YPF','Tokyo','(+353)085 209 7028',NULL,20.00),(109,'Sheehy ','https://www.instagram.com/sheehy_music?igsh=MXVtMmFnc2R4aHVvaw==','Stephensheehy17@gmail.com','Hardgroove, Hypnotic, raw, hard techno, breaks & hardcore','https://on.soundcloud.com/x4CUS','Kildare ','+353 86 338 4700',NULL,150.00),(110,'Culchee','Culchee_','culchee420@gmail.com','Multi Genre in most my sets, Techno (Hardgroove), bouncy euro trance, Jungle, Speed Garage, Electro, Ghetto tech, Gabber and Hardcore','https://on.soundcloud.com/dsMFcAWLKKyUSUn18','Kildare ','0830055899',NULL,75.00),(111,'GILLEN ','N/A','nathangillenbusiness@gmail.com','Hard/Industrial techno ','https://on.soundcloud.com/aHyYFMsjBfJU6oBC6','Lurgan ','07597741761',NULL,0.00),(112,'Enemy Of Mankind','https://www.instagram.com/toyotaflipflops?igsh=d2I3aGsxMWU3MGE3','martintj1997@gmail.com','Hard Dance / Hard Techno / Bounce / House / Techno / Hardstyle',' https://on.soundcloud.com/XD7fS','Dublin','0860859341',NULL,0.00),(113,'Spunj','@spunj420','arokhan@gmail.com','House/garage/techno/trance/dnb/dub reggae/ psytrance ','https://soundcloud.com/sponge420','Lismore, Waterford ','+354832010433',NULL,50.00),(114,'GABRIEL','https://www.instagram.com/gabriel_p.12?igsh=MWlmdHdmNm52eTZrbQ%3D%3D&utm_source=qr','gabo.parulava12@gmail.com','house ,techno.','https://soundcloud.app.goo.gl/A2sTyURAwgASu4YK9','Tbilisi','‪+353 89 235 0255‬',NULL,0.00),(115,'Blewit','https://www.instagram.com/___blewit___?igsh%3Db2p6bG4wZDVhdDVr%26utm_source%3Dqr&sa=D&source=editors&ust=1712680309890845&usg=AOvVaw1HcpIbVBmFnaPS5ZD61oCe','blewit.music@gmail.com','Hardgroove, Hard Techno, Ghetto Techno, Driving Techno, Industrial ','https://on.soundcloud.com/pzzzyjw4RdKowwBN8','Dublin ','0830382813',NULL,50.00),(116,'Savok','https://www.instagram.com/svkmusicp?igsh=ZnE5aG92cDY1dm5s&utm_source=qr','savokmusicoff@gmail.com','Tech house/ techno/ afrohouse/ house/ deep house','https://on.soundcloud.com/h3sEdS86xNTcewQP9','Dublin','+33664337115',NULL,25.00),(117,'Jayline','@jaylineukofficial','Jaylineuk@gmail.com','Dnb - tech house - bassline house - garage ','','Basildon Essex / Dublin (partner) ','+447922534841',NULL,500.00),(118,'Project MK OFTEN','https://www.instagram.com/project_mk_often','tirimanshudabass1@gmail.com','Deep, Progressive, Groove, Techno','https://soundcloud.com/projectmkoften','Dublin','(+353) 89 456 2413',NULL,50.00),(119,'STEAM LITE','https://www.instagram.com/steam_lite_dnb?igsh=MWJydnZuNWZtNnA3Mw==','danjorelihan94@gmail.com','Drum & Bass/Jungle/Breaks','https://soundcloud.com/dan-jo-relihan?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing','Cork City','+353 830251453',NULL,100.00),(120,'Stella','https://www.instagram.com/danu__dj?igsh=bXAxYThuazc2MXlm&utm_source=qr','stelladeburca1@gmail.com','Bass / Breaks / 140 / Jungle / DnB / UKG / Techno / Tribal Club / Ghetto tech / Booty Bangers / Electro / Grime ','https://on.soundcloud.com/aDj3e2wq5EELmBg57','Galway','+353863002034',NULL,150.00),(121,'DJ Scenic','@hazelaustinn','hazelmayaustin@gmail.com','Hardgroove / Groovy Techno / Hypnotic Techno','https://www.youtube.com/live/_1kCEvgZYaY?si=U77UEPM_v26UjQFy','Dublin ','(+353) 87 383 2773',NULL,150.00),(122,'Matthew²','https://www.instagram.com/mathu2/?hl=en','matthew.mathews4@gmail.com','House, Tech House, EDM','https://on.soundcloud.com/zgxZBqnt97Zwwe7E7','Wicklow','+353 86 454 1922',NULL,300.00),(123,'Nesta Tonik','https://www.instagram.com/nestatonik?igsh=a29xNDdycGhsbTFi','nestatonik@gmail.com','House music','','Lisburn','+44 07596516547',NULL,500.00),(124,'Thiago Negri','https://www.instagram.com/thiago_negri','thiagonegri.adm@gmail.com','Deep house and Tech ','https://on.soundcloud.com/7gxZGaBJnXqxXLgF9','Cork','+353834291393',NULL,300.00),(125,'DjMax','maxdj206','tolopilomax77@gmail.com','Techno, Hard Techno','My music only https://on.soundcloud.com/CCKZ1BP7p8tST5ba9','Castleblayney','0899659217',NULL,3.00),(126,'Fenska','@fenska_music','fenskamusic@outlook.com','Techno & hard groive','https://tr.ee/v4Yr2Rgxq7','Waterford','0852824512',NULL,400.00),(127,'Cxre','@cxre.wav','corbett.ben123@gmail.com','Hard techno, industrial, techno, raw','https://on.soundcloud.com/S3AnkJFb3M29FJij9','Dublin','(+353) 87 150 6657',NULL,0.00),(128,'DEN','https://www.instagram.com/danielpopovic714?igsh=MWh4c2FtYnAwZGR6Zw%3D%3D&utm_source=qr','daniel.popovic477@gmail.com','Techno/Proper, Hardgroove, Industrial, Dark, Acid, Hard Techno, Progressive, Tech-House','https://on.soundcloud.com/ZuVDBA1YqWeZ7gN88','Dublin','+383838150384',NULL,150.00),(129,'Gargi','https://www.instagram.com/gargi_digitaldvaya?igsh=ZzYxNHdibm8wamM5','samyukthagargiss@gmail.com','Psytrance- Twilight/Forest/darkpsy/dark prog','','Dublin','+353 894750021',NULL,100.00),(130,'Misstmad','https://www.instagram.com/misstmad/','misstmad@gmail.com','Psytrance/Forest/Darkpsy/Hypno techno/Tek','https://soundcloud.com/misstmad','Dublin','+40723126849',NULL,50.00),(131,'Hari','instagram.com/_.harihar._','harihar05.soccer@gmail.com','Melodic techno, progressive house, afro house, afro tech, techno ','','Barcelona','+34600538403',NULL,50.00),(132,'LADY MARU','https://www.instagram.com/ladymaru/','maruhup@gmail.com','hardtechno/ industrial techno /hardcore','https://soundcloud.com/dj-lady-maru','berlin','+393334946603',NULL,300.00),(133,'Ghanaati ','https://www.instagram.com/gha_naati?igsh=eHg2dmdocnV3emVu','parvathiv2219@gmail.com','Dark prog, darkpsy, forest , dark forest ','','Dublin ','+353830984479',NULL,50.00),(134,'Balfe','@aabalfe','Aaronbalfe1234@gmail.com','House, tech house, garage','https://on.soundcloud.com/cHQUCuyuoA1uYx2T8','Dublin ','+353 852832409',NULL,200.00),(135,'DATSKO','instagram.com/datskoooo','rebootagencybookings@gmail.com','Trance ','https://on.soundcloud.com/8gzCYQPVFYqwqLuU6','Ireland','+353 85 269 1492',NULL,800.00),(136,'Danny P','dannyp_dj','proudfootdanny09@gmail.com','House, Hard House,Techno,Tech house','Danny P','Dublin','0851286369',NULL,100.00),(137,'Bütch ','https://www.instagram.com/bradleyt_x940?igsh=MWt3N2FyMDlxaGdsOA%3D%3D&utm_source=qr','btynan06@gmail.com','Hard Techno(multiple types)/psytrance/ acid/ hard house/house ','https://on.soundcloud.com/SW7PrKAjvyzdr8xq7','Dublin','‪+353 87 760 0442‬',NULL,1.00),(138,'DaaD','https://www.instagram.com/daad_mp','daadmusicproject@gmail.com','House, melodic techno ','Listen to dj sets, a playlist by DaaD MP on #SoundCloud https://on.soundcloud.com/Da4TF','Balbriggan ','(+353) 85 285 3238',NULL,0.00),(139,'Hippyhun ','Hippyhun_x','amy.myler11@hotmail.com','Techno, house, disco, all sorts of music ','Hippyhun ','Dublin ','0851379843',NULL,0.00),(140,'Abraham Live ','https://www.instagram.com/abrahamlive_?igsh=MTZydHZtOGpjemVxag%3D%3D&utm_source=qr','aexmusic@gmail.com','House, soulful house, deep house, Tech house','','Cork','+353 83 390 7058',NULL,0.00),(141,'Sopocki','https://www.instagram.com/sopocki.mp3?igsh=bXNuZm91eW13MmVj&utm_source=qr','sopocki.booking@outlook.com','Groove, Hardgroove, Detroit Techno ','https://on.soundcloud.com/84LWjeqvfvcdAcL99','Sopot','‪+48 789 181 892‬',NULL,0.00),(142,'Fanghost ','Instagram.com/fanghost_music','motherfunker9@gmail.com','Psytech / Minimal high tech ','https://on.soundcloud.com/cj5fEiEevRUiEzBy6','Dublín ','(+353)899770650',NULL,250.00),(143,'NexTone','https://www.instagram.com/shejinjoshy?igsh=Z3R5OTdnMXF6MGI4&utm_source=qr','shejin.tuttu@gmail.com','Melodic Techno/Hard Techno/House Tech/Progressive House.','https://on.soundcloud.com/eKHPvmSyARXMesqK8','Dublin','+353 89 2783805',NULL,200.00),(144,'FoX','Lfelipelias','lfelipelias@gmail.com','Melodic, Techno, deep house, house','','Dublin','(+353) 83 202 1957',NULL,100.00),(145,'Yannick Weineck','Instagram.com/yannickweineck','yannick.weineck@gmail.com','Psy Techno / Melodic Techno / Acid Techno','Soundcloud.com/yannickweineck','Berlin','+49 15758176629',NULL,500.00),(146,'DYNN','https://www.instagram.com/dynnmusic/','dynnmusic.dj@gmail.com','Hard Industrial, Hard Techno, Rawstyle, Uptempo, Gabber','https://soundcloud.com/daniel-hernandez-82531054','Santa Cruz de Tenerife','+34 601708409',NULL,150.00),(147,'nicole lukiys','https://www.instagram.com/nicolelukiys/','nicolelkys@gmail.com','Industrial techno, hard techno, ebm, lil scharnz, BR funk references. ','https://on.soundcloud.com/HT8xUMnNfMuq8LCn6','Curitiba / based in berlin in Europe','+55 41 999242222 (whatsapp) ',NULL,350.00),(148,'PAV','https://www.instagram.com/jpg.pav?igsh=ZXI1YXlvNHAwY3d2','paul6896@gmail.com','Hard techno / euro trance / psy trance / DNB','https://on.soundcloud.com/S6Tyh','Dublin','+353 83 4590418',NULL,200.00),(149,'Sandesh Burada','https://www.instagram.com/sandeshburada?igsh=MXVzOXR6aGc0eDVhNw%3D%3D&utm_source=qr','sandeshbmusic@gmail.com','Commercial EDM','','Dublin','0874570503',NULL,150.00),(150,'AMY101','https://www.instagram.com/amy.1o1?igsh=MXEyand6YXNqcjZ1Zw%3D%3D&utm_source=qr','amybreretonmusic@gmail.com','Techno, hard techno ','https://on.soundcloud.com/5BWH22D9z3Fh6TkQ7','Kildare','+353 85 850 6136',NULL,150.00),(151,'Juan More','jef_sal92','jfe.sal92@gmail.com','Techno Dance House Tribal / HARD TECHNO','https://on.soundcloud.com/TCs4RGrrTA9rnH6T8','Dublin','3.53087E+12',NULL,0.00),(152,' THE DUO','https://www.instagram.com/itsthe_duo?igsh=NG45MDI1dmsxazVu&utm_source=qr','itstheeduo@gmail.com','Afro-House/Afro-Tech ','','Dublin ','+353 830 181 083',NULL,200.00),(153,'DJMAX','https://www.instagram.com/djmaex111/','tolopilomax777@gmail.com','Hard techno/ industrial techno','https://soundcloud.com/user-198794817/hard-techno-djmaex-mix?si=4f98f8c7a85b4cbcbc421789b42cdb2e&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing','Castleblayney','+353899659217',NULL,100.00),(154,'Dj Afro Viva','https://www.instagram.com/djafroviva_real?igsh=anFkMXhkdWx5YW1o&utm_source=qr','djafroviva12@gmail.com','House music ','','Carlow ','+353 (89) 225 6042',NULL,0.00),(155,'ADZ','ADZMusic_','adammohan63@gmail.com','House,techno,tech house ','ADZ','Dublin ','0857146244',NULL,0.00),(156,'Deejay Radu ','https://www.instagram.com/deejayradu?igsh=MTVhYjRpMTNqeXZ4aQ%3D%3D&utm_source=qr','bmxradu@yahoo.com','Minimal, Deep House, Melodic Deep House, Progressive, Afro House, Tech House, Techno ','https://www.mixcloud.com/deejayradu1/','Dublin','0879525277',NULL,50.00),(157,'DeadNSide','https://www.instagram.com/deadnside76?igsh=MTY3ajc0OTZmNG5peA==','deadnside76@gmail.com','dance, edm, trance, techno , house, acid, comercial 90s, open format ','Check out DeadNSide on #SoundCloud https://on.soundcloud.com/3cddK','Portlaoise ','086 403 6963 ',NULL,0.00),(158,'GOSIA','https://www.instagram.com/sc_gosia/','gosia.szanca@hotmail.com','Hard Techno, Techno, Industrial, Hard Groove, Hard Trance, Minimal, Deep','https://soundcloud.com/gosia_sc','Galway','(+353)894895318',NULL,0.00),(159,'Sarel Dreacks ','https://www.instagram.com/sarel.dreacks/','contact@sareldreacks.com','Techno / Celtic / Trance','https://bit.ly/47OMqFC','Les Eyzies','+ 33 6 77 24 05 03',NULL,500.00),(160,'Terre','https://www.instagram.com/djterremusic?igsh=Y2thNWMxZGs0OWJk&utm_source=qr','pjh96123@gmail.com','Tech House / Bass House / Mainstream Techno',' https://on.soundcloud.com/sqHNXW3qTCVHVCUP6','Dublin','+353 83 165 1697',NULL,70.00),(161,'Nero ','https://www.instagram.com/nerx_dj?igsh=MXA4YnE3NTIzd2t0Zg%3D%3D&utm_source=qr','contactclaudionero@gmail.com','Melodic Techno, Techno, tech house ','https://on.soundcloud.com/aNEmgJDMKfYvjmsT7','Dublin ','+353 899406908',NULL,80.00),(162,'Toltec','https://www.instagram.com/toltec_music/','toltec.musicyo@gmail.com','Hard Techno/ Peaktime Techno/ Melodic Techno/ Psytrance','https://youtu.be/a-zNFS4H2kY?si=_MxNmBMjxmlojHUp','Dublin','+353 894695098',NULL,200.00),(163,'Šimǒ','Simondelaney09','simondelaney2019@gmail.com','Hard techno / hard groove / hard house ','Simo.dj','Ashbourne ','0860552002',NULL,100.00),(164,'MISS LIPBALM','https://www.instagram.com/misslipbalmm/','leaprestage@gmail.com','Latintek, hard dance, hard trance, psytrance, guaracha, hypnotic techno, hard techno','https://on.soundcloud.com/e9nPbJZWbNWGSzLp9','Dublin','0896186600',NULL,60.00),(165,'Be_bop','@mynameisbebop','beebopofficial@gmail.com','Techno/minimal','https://on.soundcloud.com/UpD7bxuaarP5uNQH9','Porto','+351911509463',NULL,250.00),(166,'Cosmic Pulse','@ruizzrobert','robertruizzjr@gmail.com','Bass house, tech house, dub, 2step, drum and bass','No te pierdas Cosmic Pulse en #SoundCloud https://on.soundcloud.com/18Hec','Dublin','0899583186',NULL,100.00),(167,'Biassus','https://www.instagram.com/biassus_dj?igsh=MTVhcTNqOHVrOHVsYQ==','gigs.biassus@gmail.com','House/Techno (Vinil & cdjs)','@biassus','Lisboa','+55 48 991659876',NULL,250.00),(168,'Oguz','https://www.instagram.com/oguztuncell?igsh=MWRiaHQyMTRtM2NuNg%3D%3D&utm_source=qr','tuncell.07@gmail.com','Techno / house','https://on.soundcloud.com/YuS33W4nxXsv6hUg7','Dublin','+353852142152',NULL,50.00),(169,'Ryno','https://www.instagram.com/rynodj_?igsh=MXN2YWdkNThkM3cxcQ%3D%3D&utm_source=qr','ryanocon17@gmail.com','Hard techno ','https://on.soundcloud.com/NcdSpNE7zePgiEn27','Dublin','0896134566',NULL,100.00),(170,'Elliot de Perre','@elliotdeperre','contact.elliotdeperre@gmail.com','Deep House, Afro-House, Melodic Techno, Tech House,','','Bordeaux','+33 6 52 41 75 70',NULL,300.00),(171,'Mark Roma','https://www.instagram.com/markromamusic','markromadj@gmail.com','Trance / Techno / Future Rave','https://on.soundcloud.com/Phh7q','Northwich, Cheshire','+447301213833',NULL,500.00),(172,'Jamie Hayes','https://www.instagram.com/jamie_hayes01/profilecard/?igsh=MWwzb3V2aGp6aG83OA==','hayesjamie6@gmail.com','Hard House / Techno ','https://on.soundcloud.com/5uPJHRS9YUFjd9pf9','Dublin','(+353) 85-288-2030',NULL,250.00),(173,'FLOODY','__floody__','darraghflood1602@gmail.com','Techno/Trance/Hardgroove','Floody','Dublin','0852779072',NULL,150.00),(174,'ADJ','Alannahdarcy_5','alannahdarcy4@gmail.com','(House/tech house/techno)','Alannah Darcy','Dublin','0851935043',NULL,100.00),(175,'MSWENKOCEE','https://www.instagram.com/mswenkocee?igsh=MWU5MTNvdGoyc3BlOQ==','swelihledlamini23@gmail.com','Afrohouse / Afrotech ','https://linktr.ee/Mswenkocee7?utm_source=linktree_profile_share&ltsid=598b78a4-842c-4be3-a852-9277adb52087','Dublin','0894841984',NULL,100.00),(176,'Cam’s Pal','https://www.instagram.com/cams_pal_?igsh=MWh5c3pzdTBsOTVvNQ%3D%3D&utm_source=qr','seanbranvestite@gmail.com','Tech house, techno, house','https://on.soundcloud.com/bDXViu1Y6sVrMGad6','Dublin ','+353830368788',NULL,0.00),(177,'Alex Blake ','https://www.instagram.com/alexblakedj/','alexblake122006@gmail.com','Techno/ trance/ house/ Europeans / Hargroove','https://on.soundcloud.com/NB8naKC2BdV9b56n7','Dublin','(+353)  83 023 4316',NULL,100.00),(178,'LIA','https://www.instagram.com/leah_oriordan','leahoriordan20@gmail.com','Tech house, vocal house, minimal tech, garage, hardgroove','','Dublin','+353834749200',NULL,100.00),(179,'André Salvador','https://www.instagram.com/andresalvadordj/','andre_salvador@hotmail.com',' Melodic Techno / Tech House /  Afro Melodic House','https://soundcloud.com/andresalvadordj','Fafe - Braga ','(+351) 962414916',NULL,0.00),(180,'Steø','@_steo_maguire_','stephenmaguire47@gmail.com','Hard trance and techno ','https://soundcloud.com/stephen-maguire-467363064?ref=thirdParty&p=i&c=0&si=57B9A3CBE4E545819AB42F73D6D3EA94&utm_source=thirdParty&utm_medium=text&utm_campaign=social_sharing','Drogheda ','0830231407',NULL,50.00),(181,'Saight','@danillobravo','danillocarrilho@outlook.com','Psytrance/ psytechno','https://on.soundcloud.com/NVESsKxpiQQ3BQke9','Dublin ','+353834136054',NULL,200.00),(182,'DJ Frenz','https://tr.ee/N0jEFzjH3b','djfrenzofficial@gmail.com','Tech house, house, EDM, afro house','','Dublin ','+39 3771909141',NULL,100.00),(183,'Kingsmo','https://www.instagram.com/kingsmo.mp3/profilecard/?igsh=MXJzOGxrczJwYm8zaQ==','contact.kingsmo@gmail.com','Hard Trance, Techhouse, Techno','https://youtu.be/LLfUFLAroM4?si=sEssDOt1tuEB4uhL','Lyon/Montbéliard (although I tend to play in different cities every week)','+33604417179',NULL,300.00),(184,'CHACHØU','https://www.instagram.com/chachoudj/','bookingchachou@gmail.com','TECHNO/ACID TECHNO/MELODIC TECHNO/DARK PROGRESSIVE/MINIMAL TECHNO/DIRTY BASSELINE TECH','https://soundcloud.com/chachoudj/sets/live-set-festival','Cork city','(+353)851768805',NULL,250.00),(186,'UT','ut.karsh_25','utkarsh_updated@gmail.com','Hard Techno, Peak Time Techno, Melodic Techno, Deep Progressive House','https://soundcloud.com/ut_updated','Dublin','0892515620',NULL,150.00);
/*!40000 ALTER TABLE `djs` ENABLE KEYS */;
UNLOCK TABLES;

-- Add currency column for fee normalization
ALTER TABLE `djs`
  ADD COLUMN `currency` varchar(10) DEFAULT 'EUR';

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(32) DEFAULT 'user',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_preferences`
--

DROP TABLE IF EXISTS `user_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_preferences` (
  `user_id` int NOT NULL,
  `preferred_genres` json DEFAULT NULL,
  `preferred_artists` json DEFAULT NULL,
  `preferred_cities` json DEFAULT NULL,
  `preferred_venues` json DEFAULT NULL,
  `preferred_djs` json DEFAULT NULL,
  `budget_max` decimal(10,2) DEFAULT NULL,
  `radius_km` int DEFAULT NULL,
  `night_preferences` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_preferences_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_spotify`
--

DROP TABLE IF EXISTS `user_spotify`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_spotify` (
  `user_id` int NOT NULL,
  `spotify_user_id` varchar(128) NOT NULL,
  `access_token` text NOT NULL,
  `refresh_token` text,
  `token_type` varchar(32) DEFAULT 'Bearer',
  `scope` varchar(255) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `top_artists` json DEFAULT NULL,
  `top_genres` json DEFAULT NULL,
  `last_synced_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_spotify_spotify_user_id_unique` (`spotify_user_id`),
  CONSTRAINT `fk_user_spotify_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `events`
--

DROP TABLE IF EXISTS `events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dedupe_key` char(40) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `start_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `latitude` decimal(9,6) DEFAULT NULL,
  `longitude` decimal(9,6) DEFAULT NULL,
  `venue_name` varchar(255) DEFAULT NULL,
  `ticket_url` varchar(500) DEFAULT NULL,
  `age_restriction` varchar(50) DEFAULT NULL,
  `price_min` decimal(10,2) DEFAULT NULL,
  `price_max` decimal(10,2) DEFAULT NULL,
  `currency` varchar(10) DEFAULT NULL,
  `genres` json DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `images` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `events_dedupe_key_unique` (`dedupe_key`),
  KEY `events_city_start` (`city`, `start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `source_events`
--

DROP TABLE IF EXISTS `source_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `source_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source` varchar(50) NOT NULL,
  `source_id` varchar(255) NOT NULL,
  `event_id` int NOT NULL,
  `raw_payload` json DEFAULT NULL,
  `last_seen_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `source_events_unique` (`source`, `source_id`),
  KEY `source_events_event` (`event_id`),
  CONSTRAINT `fk_source_events_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ingest_state`
--

DROP TABLE IF EXISTS `ingest_state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ingest_state` (
  `source` varchar(50) NOT NULL,
  `city` varchar(100) NOT NULL,
  `last_synced_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `window_start` datetime DEFAULT NULL,
  `window_end` datetime DEFAULT NULL,
  PRIMARY KEY (`source`, `city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_saved_events`
--

DROP TABLE IF EXISTS `user_saved_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_saved_events` (
  `user_id` int NOT NULL,
  `event_id` int NOT NULL,
  `saved_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `event_id`),
  CONSTRAINT `fk_saved_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_saved_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_hidden_events`
--

DROP TABLE IF EXISTS `user_hidden_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_hidden_events` (
  `user_id` int NOT NULL,
  `event_id` int NOT NULL,
  `hidden_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `event_id`),
  KEY `user_hidden_events_event_idx` (`event_id`),
  CONSTRAINT `fk_hidden_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_hidden_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for artist alerts
--

DROP TABLE IF EXISTS `user_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_alerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `artist_name` varchar(255) NOT NULL,
  `city` varchar(100) DEFAULT NULL,
  `radius_km` int DEFAULT NULL,
  `last_notified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_alerts_user_idx` (`user_id`),
  CONSTRAINT `fk_user_alerts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for organizer event plans
--

DROP TABLE IF EXISTS `event_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `city` varchar(100) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `capacity` int DEFAULT NULL,
  `budget_min` decimal(10,2) DEFAULT NULL,
  `budget_max` decimal(10,2) DEFAULT NULL,
  `genres` json DEFAULT NULL,
  `gear_needs` json DEFAULT NULL,
  `vibe_tags` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `event_plans_user_idx` (`user_id`),
  CONSTRAINT `fk_event_plans_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for organizer shortlists
--

DROP TABLE IF EXISTS `event_plan_shortlists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_plan_shortlists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_id` int NOT NULL,
  `item_type` varchar(16) NOT NULL,
  `item_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `event_plan_shortlists_unique` (`plan_id`,`item_type`,`item_id`),
  CONSTRAINT `fk_event_plan_shortlists_plan` FOREIGN KEY (`plan_id`) REFERENCES `event_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for contact requests
--

DROP TABLE IF EXISTS `contact_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `plan_id` int DEFAULT NULL,
  `item_type` varchar(16) NOT NULL,
  `item_id` int NOT NULL,
  `message` text NOT NULL,
  `status` varchar(32) DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `contact_requests_user_idx` (`user_id`),
  KEY `contact_requests_plan_idx` (`plan_id`),
  CONSTRAINT `fk_contact_requests_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contact_requests_plan` FOREIGN KEY (`plan_id`) REFERENCES `event_plans` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `local_events`
--

DROP TABLE IF EXISTS `local_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `local_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_name` varchar(255) NOT NULL,
  `classification_name` varchar(100) DEFAULT 'Music',
  `city` varchar(100) DEFAULT 'Dublin',
  `date_local` date DEFAULT NULL,
  `time_local` time DEFAULT NULL,
  `venue_name` varchar(255) DEFAULT NULL,
  `url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `local_events`
--

LOCK TABLES `local_events` WRITE;
/*!40000 ALTER TABLE `local_events` DISABLE KEYS */;
INSERT INTO `local_events` VALUES (1,'Hard Techno Night w/ CHACHØU','Electronic','Dublin','2026-02-10','21:00:00','The Academy','https://mylocal.events/techno-chachou'),(2,'House & Tech Fest feat. ikigai3000','House','Cork','2026-03-05','20:00:00','Button Factory','https://mylocal.events/house_tech_fest'),(3,'Progressive Beats feat. Strukture','Electronic','Galway','2026-04-01','23:00:00','District 8','https://mylocal.events/progbeats_strukture'),(4,'Dub & Bass Rendezvous w/ Fizzy','Various','Dublin','2026-05-15','19:00:00','Workman\'s Club','https://mylocal.events/dub_bass_rendezvous'),(5,'Midnight Rave w/ Tech Noir','Techno','Dublin','2026-06-20','22:00:00','Wigwam','https://mylocal.events/midnight_techno'),(6,'Afrohouse Explosion feat. Mswenkocee','Electronic','Dublin','2026-07-12','21:00:00','Opium','https://mylocal.events/afro_explosion'),(7,'Sunset Tech Bash w/ Lørex','Techno','Galway','2026-08-08','20:00:00','The Grand Social','https://mylocal.events/sunset_lorex'),(8,'Deep House Session w/ Fizzy Waters','House','Cork','2026-09-10','21:30:00','Lucky\'s','https://mylocal.events/deephouse_fizzywaters'),(9,'Breaks & Bass w/ DJ haze','Various','Dublin','2026-10-15','19:30:00','Soundhouse','https://mylocal.events/breaks_bass_haze'),(10,'Melodic Techno Showcase w/ Ksara','Electronic','Dublin','2026-11-01','22:00:00','TheBackPage','https://mylocal.events/melodic_ksara'),(11,'Garage & Bass w/ Dj Gwada Mike','Various','Cork','2026-12-05','23:00:00','Fidelity','https://mylocal.events/garage_gwada'),(12,'Racket Rave w/ KIRSTY','Techno','Dublin','2026-01-10','21:00:00','Bernard Shaw/Racket','https://mylocal.events/racket_kirsty'),(13,'Deep Progressive House w/ RJ the DJ','House','Galway','2026-02-12','20:00:00','TheBigRomance','https://mylocal.events/deepprog_rj'),(14,'Acid & Hard Tech Marathon w/ Curley','Electronic','Dublin','2026-03-07','22:30:00','Grand social','https://mylocal.events/acid_curley'),(15,'Late-Night Bash w/ Ashanti Doran','Electronic','Dublin','2026-04-18','23:00:00','Cellar','https://mylocal.events/latenight_ashanti'),(16,'Hardgroove Invasion w/ Alp Bagci','Electronic','Dublin','2026-05-10','20:00:00','PYG','https://mylocal.events/hardgroove_alp'),(17,'Nu-Disco & House w/ Mswenkocee','House','Cork','2026-06-20','19:00:00','Pawn Shop','https://mylocal.events/nudisco_mswenkocee'),(18,'Peak Time Techno w/ Tech Noir','Techno','Dublin','2026-07-05','21:30:00','Izakaya/Tengu','https://mylocal.events/peaktime_noir'),(19,'DNB & Jungle w/ Fizzy Waters','Various','Galway','2026-08-11','22:00:00','Hen\'sTeeth','https://mylocal.events/dnb_fizzywaters'),(20,'Funky Beats w/ ikigai3000','Electronic','Dublin','2026-09-15','21:00:00','Lost Lane','https://mylocal.events/funky_ikigai3000');
/*!40000 ALTER TABLE `local_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venues`
--

DROP TABLE IF EXISTS `venues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `venues` (
  `id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `capacity` int DEFAULT '100',
  `genreFocus` varchar(100) DEFAULT 'Various',
  `latitude` decimal(9,6) DEFAULT NULL,
  `longitude` decimal(9,6) DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for venue availability
--

DROP TABLE IF EXISTS `venue_availability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `venue_availability` (
  `id` int NOT NULL AUTO_INCREMENT,
  `venue_id` int NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `status` varchar(32) DEFAULT 'available',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `venue_availability_venue_idx` (`venue_id`),
  CONSTRAINT `fk_venue_availability_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venues`
--

LOCK TABLES `venues` WRITE;
/*!40000 ALTER TABLE `venues` DISABLE KEYS */;
INSERT INTO `venues` VALUES (1,'The Academy','57 Middle Abbey St, North City, Dublin 1, D01 X8C2',850,'Various',53.348100,-6.260100,''),(2,'Button Factory','Curved St, Temple Bar, Dublin 2, D02 HW54',750,'Electronic',53.344600,-6.264300,''),(3,'Vicar Street','58-59 Thomas St, The Liberties, Dublin 8, D08 HC57',1050,'Various',53.342100,-6.277500,''),(4,'3Olympia Theatre','72 Dame St, Temple Bar, Dublin 2, D02 K135',1500,'Various',53.344000,-6.265000,''),(5,'Workman\'s Club','10 Wellington Quay, Temple Bar, Dublin, D02 VX36',600,'Indie/Electronic',53.345300,-6.268900,''),(6,'Opium','26 Wexford St, Dublin 2, D02 HX93',800,'Electronic/EDM',53.336600,-6.265700,''),(7,'Wigwam','54 Middle Abbey St, North City, Dublin 1, D01 E2X4',400,'House/Techno',53.347500,-6.260000,''),(9,'District 8','South Quarter, The Liberties, Dublin 8',1000,'Techno',53.338200,-6.283100,''),(10,'RIOT','11 Arcade Alley, Dublin 2',0,'Various',53.341800,-6.260800,'Doesn’t take bookings'),(11,'Sin É (basement)','43 Ormond Quay Lower, Dublin 1',80,'Various',53.346700,-6.266000,''),(12,'Pearse Street Centre','57 Pearse St, Dublin 2',300,'Electronic',53.343600,-6.244900,''),(13,'Chelsea DrugStore (basement)','25 Castle Market, Dublin 2',100,'Various',53.342000,-6.263500,''),(14,'JTPims (basement)','99 Dame St, Dublin 2',85,'House/Techno',53.344400,-6.264100,''),(15,'Pawn Shop','7 Pawn Alley, Dublin 2',140,'Electronic',53.340300,-6.263900,''),(16,'Izakaya/Tengu','10 Fownes St Upper, Temple Bar, Dublin 2',250,'EDM/House',53.344300,-6.263800,''),(17,'Soundhouse','28 Eden Quay, North City, Dublin 1',200,'Various',53.347500,-6.257200,''),(18,'PYG','59 South William St, Dublin 2',220,'Electronic',53.341300,-6.262400,''),(19,'Bernard Shaw/Racket','10 Richmond St S, Saint Kevin\'s, Dublin 2',250,'Various',53.330300,-6.265900,''),(20,'Bad Bobs','35-37 Essex St E, Temple Bar, Dublin 2',180,'Pop/Electronic',53.345000,-6.265200,''),(21,'Lost Lane','Grafton St, Dublin 2, D02 RP20',500,'Various',53.341800,-6.260200,''),(22,'Wigwam','54 Middle Abbey St, Dublin 1',400,'House/Techno',53.348500,-6.260200,''),(23,'Button factory','Curved St, Temple Bar, Dublin 2',750,'Electronic',53.344600,-6.264300,''),(24,'Bohemian Bar','99 Hippie Ln, Dublin 2',120,'Various',53.339900,-6.265800,''),(25,'Cellar','12 Underground Pl, Dublin 2',100,'Various',53.338200,-6.264400,'Bad staff'),(26,'Grand social','35 Liffey Street Lower, North City, Dublin 1',450,'Various',53.346600,-6.263200,'Only book well known acts');
/*!40000 ALTER TABLE `venues` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-19 17:44:11
