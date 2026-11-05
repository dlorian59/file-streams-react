import { FileAttachment, type FileAttachmentProps } from '@59alex/file-streams-react';
import '@59alex/file-streams-react/styles.css';

interface TicketAttachmentProps {
  readonly accountId: string;
  readonly ticketId: string;
  readonly objectsUrl?: string;
  readonly language?: 'en' | 'ru';
}

export function TicketAttachment({ accountId, ticketId, objectsUrl = '/attachments', language = 'en' }: TicketAttachmentProps) {
  // Business identity stays in the app; the backend must authorize this key for the authenticated account.
  // Бизнес-идентификатор остаётся в приложении; сервер проверяет право аккаунта на этот ключ.
  const objectKey = `${accountId}:ticket-${ticketId}.txt`;
  // The colon delimiter also works with the default Spring Security encoded-slash firewall.
  // Разделитель-двоеточие совместим с запретом encoded slash в стандартном Spring Security firewall.
  // The attachment profile matches Spring limits.profile: attachments; no byte arithmetic or stream glue.
  // Профиль соответствует Spring limits.profile: attachments; арифметика байтов и обвязка потоков не нужны.
  return <FileAttachment objectKey={objectKey} scope={accountId} objectsUrl={objectsUrl} language={language} />;
}

// Persisted metadata lets an existing screen offer download immediately, without a new upload.
// Сохранённые метаданные позволяют сразу скачать вложение на существующем экране, без новой загрузки.
export function ExistingTicketAttachment(props: Pick<FileAttachmentProps, 'objectKey' | 'scope' | 'existingFile'>) {
  return <FileAttachment {...props} objectsUrl="/attachments" />;
}
