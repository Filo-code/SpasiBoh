import Foundation
import SpasiBohCore

/// One piece of interface copy, in both interface languages.
///
/// Not a String Catalog. The UI language here is **not** the device language:
/// it follows the learning direction the learner picked in the app (§12), and
/// can be switched at runtime. Resolving through `Bundle` would mean fighting
/// the system locale on every string. A typed table also fails at compile time
/// when a string is missing, which a stringly-keyed catalogue cannot do.
///
/// The one place a String Catalog is still correct is `InfoPlist.xcstrings` —
/// those strings are rendered by iOS, not by this app, so they follow the
/// device language and there is no other mechanism available.
struct Copy: Sendable, Hashable {
    let it: String
    let ru: String

    init(it: String, ru: String) {
        self.it = it
        self.ru = ru
    }

    func callAsFunction(_ language: Language) -> String {
        switch language {
        case .italian: it
        case .russian: ru
        }
    }

    /// Interpolate a single value into both languages.
    func with(_ value: CustomStringConvertible) -> Copy {
        Copy(
            it: it.replacingOccurrences(of: "%@", with: value.description),
            ru: ru.replacingOccurrences(of: "%@", with: value.description)
        )
    }
}

extension BilingualNote {
    /// Content notes are authored bilingually too, so they read the same way.
    func callAsFunction(_ language: Language) -> String { self[language] }
}

/// All interface copy, in one place.
enum S {

    // MARK: - Onboarding

    static let tagline = Copy(it: "Italiano ↔ Русский", ru: "Italiano ↔ Русский")
    static let whatToLearn = Copy(it: "Cosa vuoi imparare?", ru: "Что хочешь выучить?")

    /// Onboarding is the one screen with no interface language yet, so each
    /// option is written in the language it leads to — the learner reads the
    /// one they understand and ignores the other.
    static let learnRussianSubtitle = "Imparo il russo — l'app sarà in italiano"
    static let learnItalianSubtitle = "Учу итальянский — приложение будет на русском"
    static let changeLater = "Puoi cambiare dopo · Можно изменить позже"

    // MARK: - Home

    static let streak = Copy(it: "Serie", ru: "Серия")
    static let words = Copy(it: "Parole", ru: "Слова")
    static let total = Copy(it: "Totale", ru: "Всего")
    static let continueSession = Copy(it: "CONTINUA SESSIONE", ru: "ПРОДОЛЖИТЬ СЕССИЮ")
    static let startSession = Copy(it: "INIZIA LA SESSIONE", ru: "НАЧАТЬ СЕССИЮ")
    static let freeTraining = Copy(it: "Allenamento libero", ru: "Свободная тренировка")
    static let settings = Copy(it: "Impostazioni", ru: "Настройки")
    static let changeDirection = Copy(it: "Cambia direzione", ru: "Сменить направление")

    // MARK: - Training modes

    static let modeWarmupRU = Copy(it: "Alfabeto cirillico", ru: "Кириллица")
    static let modeWarmupIT = Copy(it: "Pronuncia italiana", ru: "Итальянское произношение")
    static let modeVocabulary = Copy(it: "Vocabolario", ru: "Словарь")
    static let modeListening = Copy(it: "Ascolto", ru: "Аудирование")
    static let modePronunciation = Copy(it: "Pronuncia", ru: "Произношение")
    static let modeTranslation = Copy(it: "Traduzione", ru: "Перевод")
    static let modeSentences = Copy(it: "Frasi", ru: "Фразы")
    static let modeScenarios = Copy(it: "Situazioni reali", ru: "Реальные ситуации")
    static let modeMistakes = Copy(it: "I miei errori", ru: "Мои ошибки")
    static let modeCollection = Copy(it: "Collezione", ru: "Коллекция")
    static let modeStats = Copy(it: "Statistiche", ru: "Статистика")

    // MARK: - Exercise instructions

    static let chooseMeaning = Copy(it: "Cosa significa?", ru: "Что это значит?")
    static let chooseTranslation = Copy(it: "Come si dice?", ru: "Как это сказать?")
    static let listenAndChoose = Copy(it: "Ascolta e scegli", ru: "Послушай и выбери")
    static let sayItAloud = Copy(it: "Dillo ad alta voce", ru: "Скажи вслух")
    static let spellIt = Copy(it: "Scrivi la parola", ru: "Собери слово")
    static let buildSentence = Copy(it: "Costruisci la frase", ru: "Собери фразу")
    static let fillTheGap = Copy(it: "Completa la frase", ru: "Заполни пропуск")
    static let chooseReply = Copy(it: "Scegli la risposta", ru: "Выбери ответ")
    static let whichSound = Copy(it: "Che suono fa?", ru: "Какой это звук?")
    static let whichLetter = Copy(it: "Quale lettera?", ru: "Какая буква?")
    static let whichWord = Copy(it: "Quale parola hai sentito?", ru: "Какое слово ты услышал?")

    // MARK: - Exercise controls

    static let check = Copy(it: "Verifica", ru: "Проверить")
    static let next = Copy(it: "Avanti", ru: "Дальше")
    static let skip = Copy(it: "Salta", ru: "Пропустить")
    static let listen = Copy(it: "Ascolta", ru: "Послушать")
    static let listenSlowly = Copy(it: "Più lento", ru: "Помедленнее")
    static let tapToSpeak = Copy(it: "Tocca e parla", ru: "Нажми и говори")
    static let listening = Copy(it: "Ti sto ascoltando…", ru: "Слушаю…")
    static let clear = Copy(it: "Cancella", ru: "Очистить")
    static let correct = Copy(it: "Giusto!", ru: "Верно!")
    static let wrong = Copy(it: "Non ci siamo", ru: "Не совсем")
    static let correctAnswerWas = Copy(it: "La risposta era", ru: "Правильный ответ")
    static let iHeard = Copy(it: "Ho sentito", ru: "Я услышал")
    static let close = Copy(it: "Chiudi", ru: "Закрыть")
    static let cancel = Copy(it: "Annulla", ru: "Отмена")
    static let back = Copy(it: "Indietro", ru: "Назад")

    /// Shown when a wrong answer is rescheduled instead of costing a life (§18).
    static let willComeBack = Copy(
        it: "Nessun problema: torna tra poco.",
        ru: "Ничего страшного: вернётся чуть позже."
    )

    // MARK: - Session recap

    static let sessionDone = Copy(it: "Sessione completata", ru: "Сессия завершена")
    static let answered = Copy(it: "Risposte", ru: "Ответов")
    static let accuracy = Copy(it: "Precisione", ru: "Точность")
    static let xpEarned = Copy(it: "XP guadagnati", ru: "Заработано XP")
    static let toReview = Copy(it: "Da ripassare", ru: "На повторение")
    static let backToHome = Copy(it: "Torna alla home", ru: "На главную")
    static let nothingToReview = Copy(
        it: "Nessun errore da ripassare. Bel lavoro.",
        ru: "Ошибок для повторения нет. Отлично."
    )
    static let noExercises = Copy(
        it: "Non c'è nulla da allenare qui, per ora.",
        ru: "Здесь пока нечего тренировать."
    )
    static let streakDay = Copy(it: "Giorno %@ di fila", ru: "%@-й день подряд")

    // MARK: - Scenarios

    static let scenarios = Copy(it: "Situazioni reali", ru: "Реальные ситуации")
    static let startScenario = Copy(it: "Inizia", ru: "Начать")
    static let scenarioComplete = Copy(it: "Situazione completata", ru: "Ситуация пройдена")
    static let stepOf = Copy(it: "Passo %@", ru: "Шаг %@")

    // MARK: - Collection, culture, tips

    static let collection = Copy(it: "Collezione", ru: "Коллекция")
    static let cultureCards = Copy(it: "Cultura", ru: "Культура")
    static let languageTips = Copy(it: "Consigli di lingua", ru: "Советы по языку")
    static let idioms = Copy(it: "Modi di dire", ru: "Идиомы")
    static let locked = Copy(it: "Da sbloccare", ru: "Ещё не открыто")
    static let unlockedAt = Copy(it: "Sbloccato a %@ XP", ru: "Открывается на %@ XP")
    static let source = Copy(it: "Fonte", ru: "Источник")
    static let literally = Copy(it: "Alla lettera", ru: "Дословно")
    static let actuallyMeans = Copy(it: "Significa", ru: "Значит")
    static let whenToUse = Copy(it: "Quando si usa", ru: "Когда использовать")

    // MARK: - Statistics

    static let statistics = Copy(it: "Statistiche", ru: "Статистика")
    static let sessionHistory = Copy(it: "Cronologia", ru: "История")
    static let bestStreak = Copy(it: "Serie migliore", ru: "Лучшая серия")
    static let totalXP = Copy(it: "XP totali", ru: "Всего XP")
    static let itemsStarted = Copy(it: "Iniziate", ru: "Начато")
    static let itemsMastered = Copy(it: "Padroneggiate", ru: "Освоено")
    static let perSkill = Copy(it: "Per abilità", ru: "По навыкам")
    static let noSessionsYet = Copy(it: "Nessuna sessione ancora.", ru: "Пока нет сессий.")

    static func skillName(_ skill: Skill) -> Copy {
        switch skill {
        case .recognition: Copy(it: "Riconoscimento", ru: "Узнавание")
        case .recall: Copy(it: "Produzione", ru: "Воспроизведение")
        case .listening: Copy(it: "Ascolto", ru: "Аудирование")
        case .pronunciation: Copy(it: "Pronuncia", ru: "Произношение")
        case .spelling: Copy(it: "Ortografia", ru: "Правописание")
        case .sentenceUsage: Copy(it: "Uso in frase", ru: "В предложении")
        }
    }

    // MARK: - Achievements

    static let achievements = Copy(it: "Obiettivi", ru: "Достижения")

    // MARK: - Settings, data

    static let learningDirection = Copy(it: "Direzione di studio", ru: "Направление обучения")
    static let exportProgress = Copy(it: "Esporta i progressi", ru: "Экспорт прогресса")
    static let importProgress = Copy(it: "Importa i progressi", ru: "Импорт прогресса")
    static let resetProgress = Copy(it: "Azzera i progressi", ru: "Сбросить прогресс")
    static let resetWarning = Copy(
        it: "Cancella tutto: parole, serie, XP, cronologia. Non si può annullare.",
        ru: "Удалит всё: слова, серию, XP, историю. Отменить нельзя."
    )
    static let resetConfirm = Copy(it: "Azzera tutto", ru: "Сбросить всё")
    static let importWarning = Copy(
        it: "Questo sostituirà i progressi attuali. Non si può annullare.",
        ru: "Это заменит текущий прогресс. Отменить нельзя."
    )
    static let importConfirm = Copy(it: "Sostituisci", ru: "Заменить")
    static let importSummary = Copy(
        it: "Export del %@ · %@ elementi · %@ XP",
        ru: "Экспорт от %@ · %@ элементов · %@ XP"
    )
    static let importFailed = Copy(it: "Importazione non riuscita", ru: "Импорт не удался")
    static let exportShare = Copy(it: "Condividi il file", ru: "Поделиться файлом")

    // MARK: - Permissions and failures

    static let micNeeded = Copy(
        it: "Serve il microfono per gli esercizi di pronuncia.",
        ru: "Для упражнений на произношение нужен микрофон."
    )
    static let micDenied = Copy(
        it: "Microfono non disponibile: gli esercizi di pronuncia sono disattivati.",
        ru: "Микрофон недоступен: упражнения на произношение отключены."
    )
    static let openSettings = Copy(it: "Apri Impostazioni", ru: "Открыть настройки")
    static let speechUnavailable = Copy(
        it: "Riconoscimento vocale non disponibile su questo dispositivo.",
        ru: "Распознавание речи недоступно на этом устройстве."
    )
    static let contentFailed = Copy(
        it: "I contenuti non si sono caricati.",
        ru: "Не удалось загрузить материалы."
    )
}
