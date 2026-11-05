import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TicketAttachment } from './TicketAttachment.js';

// Local integration uses Spring's real /objects endpoint; the application supplies authentication in production.
// Локальная интеграция использует настоящий /objects Spring; в production авторизацию задаёт приложение.
const language = new URLSearchParams(location.search).get('lang') === 'ru' ? 'ru' : 'en';
document.documentElement.lang = language;
createRoot(document.getElementById('root')!).render(<StrictMode><main>
  <header>file-streams-react <span>REACT → SPRING WEBFLUX → S3</span></header>
  <h1>{language === 'ru' ? 'Вложение к заявке' : 'A ticket attachment'}</h1>
  <p>{language === 'ru' ? 'Готовый компонент: выбрать, загрузить, скачать.' : 'One ready component: choose, upload, download.'}</p>
  <TicketAttachment accountId="demo-account" ticketId={`visual-${language}`} language={language}
    objectsUrl="https://127.0.0.1:19443/objects" />
  <footer>{language === 'ru' ? 'Запись: Spring WebFlux + Garage S3 API · задержка транспорта для читаемости' : 'Recording: Spring WebFlux + Garage S3 API · transport paced for readability'}</footer>
</main></StrictMode>);
