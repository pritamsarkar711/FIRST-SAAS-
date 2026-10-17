import { createInertiaApp } from '@inertiajs/react';
import { createRoot, type ReactNode } from 'react-dom/client';
import '../css/app.css';
import { ThemeProvider } from './components/shared/theme';
import { Toaster } from './components/ui/toaster';

createInertiaApp({
    title: (title) => (title ? `${title} | Audit Form` : 'Audit Form — Know your AdSense approval odds before you apply'),
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.tsx');
        return pages[`./Pages/${name}.tsx`]();
    },
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
                <App {...props} />
                <Toaster />
            </ThemeProvider> as ReactNode,
        );
    },
    progress: { color: '#f86642' },
});
