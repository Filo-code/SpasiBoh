import type { Phrase } from '@/types/content'

/** Hotel check-in / stay and shopping. */
export const STAY_PHRASES: Phrase[] = [
  // ------------------------------------------------------------------ hotel
  { id: 'htl-01', russian: 'У меня бронь.', italian: 'Ho una prenotazione.', transliteration: 'u minjà bron', category: 'hotel', difficulty: 2, keywords: ['bron'], audioText: 'У меня бронь.', distractors: ['ключ', 'где'] },
  { id: 'htl-02', russian: 'У вас есть свободная комната?', italian: 'Avete una camera libera?', transliteration: 'u vas jest svabòdnaja kòmnata', category: 'hotel', difficulty: 3, keywords: ['svobodnyy', 'komnata'], audioText: 'У вас есть свободная комната?' },
  { id: 'htl-03', russian: 'На две ночи.', italian: 'Per due notti.', transliteration: 'na dve nòchi', category: 'hotel', difficulty: 2, keywords: ['dva', 'noch'], audioText: 'На две ночи.', distractors: ['три', 'дня'] },
  { id: 'htl-04', russian: 'На одного человека.', italian: 'Per una persona.', transliteration: 'na adnavò chilavèka', category: 'hotel', difficulty: 3, keywords: ['odin', 'chelovek'], audioText: 'На одного человека.' },
  { id: 'htl-05', russian: 'Во сколько завтрак?', italian: 'A che ora è la colazione?', transliteration: 'va skòl\'ka zàvtrak', category: 'hotel', difficulty: 2, keywords: ['skolko', 'zavtrak'], audioText: 'Во сколько завтрак?' },
  { id: 'htl-06', russian: 'Во сколько выезд?', italian: 'A che ora è il check-out?', transliteration: 'va skòl\'ka vỳjizd', category: 'hotel', difficulty: 4, keywords: ['skolko'], audioText: 'Во сколько выезд?' },
  { id: 'htl-07', russian: 'Можно оставить багаж?', italian: 'Posso lasciare il bagaglio?', transliteration: 'mòzhna astàvit bagàsh', category: 'hotel', difficulty: 3, keywords: ['mozhno', 'ostavit', 'bagazh'], audioText: 'Можно оставить багаж?' },
  { id: 'htl-08', russian: 'Где моя комната?', italian: 'Dov\'è la mia camera?', transliteration: 'gde majà kòmnata', category: 'hotel', difficulty: 2, keywords: ['gde', 'komnata'], audioText: 'Где моя комната?' },
  { id: 'htl-09', russian: 'Какой пароль от Wi-Fi?', italian: 'Qual è la password del Wi-Fi?', transliteration: 'kakòj paròl at vàj-fàja', category: 'hotel', difficulty: 3, keywords: ['kakoy', 'parol'], audioText: 'Какой пароль от вай-фая?' },
  { id: 'htl-10', russian: 'Ключ, пожалуйста.', italian: 'La chiave, per favore.', transliteration: 'klyuch, pazhàlusta', category: 'hotel', difficulty: 1, keywords: ['klyuch', 'pozhaluysta'], audioText: 'Ключ, пожалуйста.' },
  { id: 'htl-11', russian: 'В комнате холодно.', italian: 'In camera fa freddo.', transliteration: 'f kòmnate hòladna', category: 'hotel', difficulty: 3, keywords: ['komnata', 'kholodno'], audioText: 'В комнате холодно.' },
  { id: 'htl-12', russian: 'Не работает душ.', italian: 'La doccia non funziona.', transliteration: 'ni rabòtajit dush', category: 'hotel', difficulty: 3, keywords: ['rabotat', 'dush'], audioText: 'Не работает душ.' },
  { id: 'htl-13', russian: 'Можно ещё одно полотенце?', italian: 'Posso avere un altro asciugamano?', transliteration: 'mòzhna jishchò adnò palatèntse', category: 'hotel', difficulty: 4, keywords: ['mozhno', 'polotentse'], audioText: 'Можно ещё одно полотенце?' },
  { id: 'htl-14', russian: 'Где лифт?', italian: 'Dov\'è l\'ascensore?', transliteration: 'gde lift', category: 'hotel', difficulty: 1, keywords: ['gde', 'lift'], audioText: 'Где лифт?' },
  { id: 'htl-15', russian: 'На каком этаже?', italian: 'A che piano?', transliteration: 'na kakòm etazhè', category: 'hotel', difficulty: 3, keywords: ['kakoy', 'etazh'], audioText: 'На каком этаже?' },
  { id: 'htl-16', russian: 'Вот мой паспорт и бронь.', italian: 'Ecco il mio passaporto e la prenotazione.', transliteration: 'vot moj pàspart i bron', category: 'hotel', difficulty: 3, keywords: ['pasport', 'bron'], audioText: 'Вот мой паспорт и бронь.' },

  // --------------------------------------------------------------- shopping
  { id: 'shp-01', russian: 'Сколько это стоит?', italian: 'Quanto costa questo?', transliteration: 'skòl\'ka èta stòit', category: 'shopping', difficulty: 1, keywords: ['skolko', 'eto', 'stoit'], audioText: 'Сколько это стоит?', distractors: ['где', 'дорого'] },
  { id: 'shp-02', russian: 'Это слишком дорого.', italian: 'È troppo caro.', transliteration: 'èta slìshkam dòraga', category: 'shopping', difficulty: 3, keywords: ['eto', 'dorogo'], audioText: 'Это слишком дорого.' },
  { id: 'shp-03', russian: 'У вас есть скидка?', italian: 'Fate uno sconto?', transliteration: 'u vas jest skìtka', category: 'shopping', difficulty: 3, keywords: ['skidka'], audioText: 'У вас есть скидка?' },
  { id: 'shp-04', russian: 'Можно примерить?', italian: 'Posso provarlo?', transliteration: 'mòzhna primèrit', category: 'shopping', difficulty: 3, keywords: ['mozhno'], audioText: 'Можно примерить?' },
  { id: 'shp-05', russian: 'У вас есть другой размер?', italian: 'Avete un\'altra taglia?', transliteration: 'u vas jest drugòj razmèr', category: 'shopping', difficulty: 3, keywords: ['razmer'], audioText: 'У вас есть другой размер?' },
  { id: 'shp-06', russian: 'Я просто смотрю.', italian: 'Sto solo guardando.', transliteration: 'ja pròsta smatrjù', category: 'shopping', difficulty: 3, keywords: ['smotret'], audioText: 'Я просто смотрю.' },
  { id: 'shp-07', russian: 'Я возьму это.', italian: 'Prendo questo.', transliteration: 'ja vaz\'mù èta', category: 'shopping', difficulty: 3, keywords: ['brat-prendere', 'eto'], audioText: 'Я возьму это.' },
  { id: 'shp-08', russian: 'Можно пакет?', italian: 'Posso avere un sacchetto?', transliteration: 'mòzhna pakèt', category: 'shopping', difficulty: 2, keywords: ['mozhno', 'paket'], audioText: 'Можно пакет?' },
  { id: 'shp-09', russian: 'Можно чек?', italian: 'Posso avere lo scontrino?', transliteration: 'mòzhna chek', category: 'shopping', difficulty: 2, keywords: ['mozhno', 'chek'], audioText: 'Можно чек?' },
  { id: 'shp-10', russian: 'Можно заплатить наличными?', italian: 'Posso pagare in contanti?', transliteration: 'mòzhna zaplatìt nalìchnymi', category: 'shopping', difficulty: 4, keywords: ['platit', 'nalichnye'], audioText: 'Можно заплатить наличными?' },
  { id: 'shp-11', russian: 'Где примерочная?', italian: 'Dov\'è il camerino?', transliteration: 'gde primèrachnaja', category: 'shopping', difficulty: 4, keywords: ['gde'], audioText: 'Где примерочная?' },
  { id: 'shp-12', russian: 'У вас есть это в чёрном?', italian: 'Ce l\'avete in nero?', transliteration: 'u vas jest èta v chòrnam', category: 'shopping', difficulty: 4, keywords: ['chyornyy'], audioText: 'У вас есть это в чёрном?' },
  { id: 'shp-13', russian: 'Во сколько вы закрываетесь?', italian: 'A che ora chiudete?', transliteration: 'va skòl\'ka vy zakryvàjites', category: 'shopping', difficulty: 4, keywords: ['skolko', 'zakryt'], audioText: 'Во сколько вы закрываетесь?' },
]
