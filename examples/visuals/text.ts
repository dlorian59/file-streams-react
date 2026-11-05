import { englishLabels, russianLabels } from '@59alex/file-streams-react';
export type Language = 'en' | 'ru';
export function messages(language: Language) {
  return language === 'en' ? {
    labels: englishLabels, attachment: 'An attachment, from selection to storage', select: 'Choose a file, upload it, then stream the confirmed object to OPFS.',
    upload: 'Upload', download: 'Download', chosen: 'Confirmed by the fixture', saved: 'Destination closed',
    hook: 'Cancel a transfer without hiding uncertainty', hookHint: 'Stop the stream, check the object, then make a deliberate new attempt.',
    start: 'Start upload', stop: 'Cancel upload', check: 'Check object', absent: 'Fixture reports 404. A new source can be created.',
    present: 'The object exists. Inspect it before another attempt.', checking: 'Checking fixture…', retry: 'Retry with a fresh stream',
    preview: 'Read a prefix, not the complete file', previewHint: 'Request 32 KiB with Range; render only a bounded text preview.',
    read: 'Read prefix', action: 'A native React 19 upload form', actionHint: 'The Action stays pending until the PUT response confirms the object.',
    file: 'Attachment', submit: 'Attach file', pending: 'Action pending · waiting for a verified result', idle: 'Ready for a file',
    progress: 'Bytes read are not a storage confirmation.', fixture: 'Local HTTP/2 memory fixture · paced for recording · not S3',
    accepted: 'Confirmed', code: 'Reported outcome',
  } : {
    labels: russianLabels, attachment: 'Вложение: от выбора до сохранения', select: 'Выберите файл, загрузите и скачайте подтверждённый объект в OPFS.',
    upload: 'Загрузка', download: 'Скачивание', chosen: 'Подтверждено fixture', saved: 'Назначение закрыто',
    hook: 'Отмена без ложного обещания отката', hookHint: 'Остановите поток, проверьте объект и осознанно повторите попытку.',
    start: 'Передать поток', stop: 'Отменить передачу', check: 'Проверить объект', absent: 'Fixture вернул 404. Можно создать новый источник.',
    present: 'Объект существует. Проверьте его перед повтором.', checking: 'Проверяем fixture…', retry: 'Повторить с новым потоком',
    preview: 'Прочитать начало, а не весь файл', previewHint: 'Запросите 32 КиБ через Range; покажите ограниченный текстовый фрагмент.',
    read: 'Прочитать начало', action: 'Нативная форма загрузки React 19', actionHint: 'Action остаётся pending до подтверждения объекта в ответе PUT.',
    file: 'Вложение', submit: 'Прикрепить файл', pending: 'Action pending · ожидаем проверенный результат', idle: 'Можно выбрать файл',
    progress: 'Прочитанные байты ещё не означают сохранение.', fixture: 'Локальный HTTP/2 memory fixture · задержка для записи · не S3',
    accepted: 'Подтверждено', code: 'Результат операции',
  };
}
