import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Components } from './Components.js';
import { HookUpload } from './HookUpload.js';
import { HookDownload } from './HookDownload.js';
import { ActionForm } from './ActionForm.js';
import { messages, type Language } from './text.js';

// Query parameters select a runnable example, not documentation pages.
// Query-параметры выбирают запускаемый пример, а не страницы документации.
const query = new URLSearchParams(location.search);
const language: Language = query.get('lang') === 'ru' ? 'ru' : 'en';
const scenario = query.get('scenario') ?? 'components';
const Scenario = scenario === 'upload' ? HookUpload : scenario === 'download' ? HookDownload : scenario === 'action' ? ActionForm : Components;
document.documentElement.lang = language;
createRoot(document.getElementById('root')!).render(<StrictMode><main>
  <header><strong>file-streams-react</strong><span>REACT · STREAMING FILES</span></header>
  <Scenario language={language} />
  <footer>{messages(language).fixture}</footer>
</main></StrictMode>);
