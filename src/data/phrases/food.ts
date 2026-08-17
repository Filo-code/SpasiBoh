import type { Phrase } from '@/types/content'

/** Restaurant and bar. */
export const FOOD_PHRASES: Phrase[] = [
  // ------------------------------------------------------------- ristorante
  { id: 'res-01', russian: 'Можно меню?', italian: 'Posso avere il menù?', transliteration: 'mòzhna minjù', category: 'ristorante', difficulty: 1, keywords: ['mozhno', 'menyu'], audioText: 'Можно меню?', distractors: ['счёт', 'где'] },
  { id: 'res-02', russian: 'Меню, пожалуйста.', italian: 'Il menù, per favore.', transliteration: 'minjù, pazhàlusta', category: 'ristorante', difficulty: 1, keywords: ['menyu', 'pozhaluysta'], audioText: 'Меню, пожалуйста.' },
  { id: 'res-03', russian: 'Я хотел бы пиццу.', italian: 'Vorrei una pizza.', transliteration: 'ja hatèl by pìtsu', category: 'ristorante', difficulty: 3, keywords: ['khotet', 'pitstsa'], audioText: 'Я хотел бы пиццу.', distractors: ['пиво', 'где'] },
  { id: 'res-04', russian: 'Что вы посоветуете?', italian: 'Cosa mi consiglia?', transliteration: 'shto vy pasavètujite', category: 'ristorante', difficulty: 4, keywords: ['chto', 'vy'], audioText: 'Что вы посоветуете?' },
  { id: 'res-05', russian: 'Счёт, пожалуйста.', italian: 'Il conto, per favore.', transliteration: 'shchot, pazhàlusta', category: 'ristorante', difficulty: 2, keywords: ['schyot', 'pozhaluysta'], audioText: 'Счёт, пожалуйста.' },
  { id: 'res-06', russian: 'Сколько стоит?', italian: 'Quanto costa?', transliteration: 'skòl\'ka stòit', category: 'ristorante', difficulty: 1, keywords: ['skolko', 'stoit'], audioText: 'Сколько стоит?' },
  { id: 'res-07', russian: 'Без лука, пожалуйста.', italian: 'Senza cipolla, per favore.', transliteration: 'bes lùka, pazhàlusta', category: 'ristorante', difficulty: 2, keywords: ['bez', 'luk', 'pozhaluysta'], audioText: 'Без лука, пожалуйста.', distractors: ['соль', 'с'] },
  { id: 'res-08', russian: 'Очень вкусно!', italian: 'Molto buono!', transliteration: 'òchen fkùsna', category: 'ristorante', difficulty: 1, keywords: ['ochen', 'vkusno'], audioText: 'Очень вкусно!' },
  { id: 'res-09', russian: 'Столик на двоих, пожалуйста.', italian: 'Un tavolo per due, per favore.', transliteration: 'stòlik na dvaìh, pazhàlusta', category: 'ristorante', difficulty: 3, keywords: ['stolik', 'dva'], audioText: 'Столик на двоих, пожалуйста.' },
  { id: 'res-10', russian: 'У вас есть свободный столик?', italian: 'Avete un tavolo libero?', transliteration: 'u vas jest svabòdnyj stòlik', category: 'ristorante', difficulty: 3, keywords: ['svobodnyy', 'stolik'], audioText: 'У вас есть свободный столик?' },
  { id: 'res-11', russian: 'У меня аллергия на орехи.', italian: 'Sono allergico alle noci.', transliteration: 'u minjà alirgìja na arèhi', category: 'ristorante', difficulty: 4, keywords: ['allergiya'], audioText: 'У меня аллергия на орехи.' },
  { id: 'res-12', russian: 'Я вегетарианец.', italian: 'Sono vegetariano.', transliteration: 'ja vigitariànets', category: 'ristorante', difficulty: 3, keywords: ['vegetarianets'], audioText: 'Я вегетарианец.' },
  { id: 'res-13', russian: 'Можно ещё воды?', italian: 'Posso avere ancora dell\'acqua?', transliteration: 'mòzhna jishchò vadỳ', category: 'ristorante', difficulty: 3, keywords: ['mozhno', 'eshchyo', 'voda'], audioText: 'Можно ещё воды?' },
  { id: 'res-14', russian: 'Это очень остро.', italian: 'È molto piccante.', transliteration: 'èta òchen òstra', category: 'ristorante', difficulty: 3, keywords: ['ochen', 'ostryy'], audioText: 'Это очень остро.' },
  { id: 'res-15', russian: 'Я это не заказывал.', italian: 'Non ho ordinato questo.', transliteration: 'ja èta ni zakàzyval', category: 'ristorante', difficulty: 4, keywords: ['zakazat'], audioText: 'Я это не заказывал.' },
  { id: 'res-16', russian: 'Мы готовы заказать.', italian: 'Siamo pronti per ordinare.', transliteration: 'my gàtavy zakazàt', category: 'ristorante', difficulty: 3, keywords: ['zakazat', 'my'], audioText: 'Мы готовы заказать.' },
  { id: 'res-17', russian: 'Всё было отлично, спасибо.', italian: 'Era tutto ottimo, grazie.', transliteration: 'vsyo bỳla atlìchna, spasìba', category: 'ristorante', difficulty: 4, keywords: ['vsyo', 'spasibo'], audioText: 'Всё было отлично, спасибо.' },
  { id: 'res-18', russian: 'Приятного аппетита!', italian: 'Buon appetito!', transliteration: 'prijàtnava apitìta', category: 'ristorante', difficulty: 3, keywords: ['eda'], audioText: 'Приятного аппетита!' },
  { id: 'res-19', russian: 'Можно счёт отдельно?', italian: 'Possiamo pagare separatamente?', transliteration: 'mòzhna shchot atdèl\'na', category: 'ristorante', difficulty: 4, keywords: ['mozhno', 'schyot'], audioText: 'Можно счёт отдельно?' },
  { id: 'res-20', russian: 'Я забронировал столик.', italian: 'Ho prenotato un tavolo.', transliteration: 'ja zabranìraval stòlik', category: 'ristorante', difficulty: 4, keywords: ['zabronirovat', 'stolik'], audioText: 'Я забронировал столик.' },
  { id: 'res-21', russian: 'Что это такое?', italian: 'Che cos\'è questo?', transliteration: 'shto èta takòje', category: 'ristorante', difficulty: 2, keywords: ['chto', 'eto'], audioText: 'Что это такое?' },
  { id: 'res-22', russian: 'Мне это, пожалуйста.', italian: 'Questo, per favore.', transliteration: 'mne èta, pazhàlusta', category: 'ristorante', difficulty: 2, keywords: ['eto', 'pozhaluysta'], audioText: 'Мне это, пожалуйста.', notes: 'Utilissima: basta indicare il menù.' },

  // -------------------------------------------------------------------- bar
  { id: 'bar-01', russian: 'Одно пиво, пожалуйста.', italian: 'Una birra, per favore.', transliteration: 'adnò pìva, pazhàlusta', category: 'bar', difficulty: 2, keywords: ['odin', 'pivo', 'pozhaluysta'], audioText: 'Одно пиво, пожалуйста.', distractors: ['вино', 'два'] },
  { id: 'bar-02', russian: 'Два пива, пожалуйста.', italian: 'Due birre, per favore.', transliteration: 'dva pìva, pazhàlusta', category: 'bar', difficulty: 2, keywords: ['dva', 'pivo'], audioText: 'Два пива, пожалуйста.' },
  { id: 'bar-03', russian: 'Воду, пожалуйста.', italian: 'Acqua, per favore.', transliteration: 'vòdu, pazhàlusta', category: 'bar', difficulty: 1, keywords: ['voda', 'pozhaluysta'], audioText: 'Воду, пожалуйста.' },
  { id: 'bar-04', russian: 'Воду без газа, пожалуйста.', italian: 'Acqua naturale, per favore.', transliteration: 'vòdu bes gàza, pazhàlusta', category: 'bar', difficulty: 3, keywords: ['voda', 'bez'], audioText: 'Воду без газа, пожалуйста.' },
  { id: 'bar-05', russian: 'Один кофе, пожалуйста.', italian: 'Un caffè, per favore.', transliteration: 'adìn kòfe, pazhàlusta', category: 'bar', difficulty: 1, keywords: ['odin', 'kofe'], audioText: 'Один кофе, пожалуйста.' },
  { id: 'bar-06', russian: 'Чай с лимоном, пожалуйста.', italian: 'Tè al limone, per favore.', transliteration: 'chaj s limònam, pazhàlusta', category: 'bar', difficulty: 2, keywords: ['chay', 'limon'], audioText: 'Чай с лимоном, пожалуйста.' },
  { id: 'bar-07', russian: 'Бокал красного вина, пожалуйста.', italian: 'Un calice di vino rosso, per favore.', transliteration: 'bakàl kràsnava vinà, pazhàlusta', category: 'bar', difficulty: 4, keywords: ['krasnyy', 'vino'], audioText: 'Бокал красного вина, пожалуйста.' },
  { id: 'bar-08', russian: 'Со льдом, пожалуйста.', italian: 'Con ghiaccio, per favore.', transliteration: 'sa l\'dòm, pazhàlusta', category: 'bar', difficulty: 3, keywords: ['lyod'], audioText: 'Со льдом, пожалуйста.' },
  { id: 'bar-09', russian: 'Без сахара, пожалуйста.', italian: 'Senza zucchero, per favore.', transliteration: 'bes sàhara, pazhàlusta', category: 'bar', difficulty: 2, keywords: ['bez', 'sakhar'], audioText: 'Без сахара, пожалуйста.' },
  { id: 'bar-10', russian: 'Ещё один, пожалуйста.', italian: 'Un altro, per favore.', transliteration: 'jishchò adìn, pazhàlusta', category: 'bar', difficulty: 2, keywords: ['eshchyo', 'odin'], audioText: 'Ещё один, пожалуйста.' },
  { id: 'bar-11', russian: 'Здесь есть Wi-Fi?', italian: 'C\'è il Wi-Fi qui?', transliteration: 'zdes jest vàj-fàj', category: 'bar', difficulty: 2, keywords: ['zdes', 'internet'], audioText: 'Здесь есть вай-фай?' },
  { id: 'bar-12', russian: 'Что у вас есть?', italian: 'Che cosa avete?', transliteration: 'shto u vas jest', category: 'bar', difficulty: 2, keywords: ['chto', 'vy'], audioText: 'Что у вас есть?' },
  { id: 'bar-13', russian: 'На вынос, пожалуйста.', italian: 'Da portare via, per favore.', transliteration: 'na vỳnas, pazhàlusta', category: 'bar', difficulty: 3, keywords: ['pozhaluysta'], audioText: 'На вынос, пожалуйста.' },
]
