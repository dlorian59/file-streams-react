import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Attachments } from './Attachments.js';

// StrictMode also exercises effect cleanup during local development.
// StrictMode дополнительно проверяет очистку effects при локальной разработке.
createRoot(document.getElementById('root')!).render(<StrictMode><Attachments /></StrictMode>);
