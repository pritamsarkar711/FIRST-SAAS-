import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    server: {
        host: '0.0.0.0',
        hmr: {
            host: 'localhost',
        },
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
    build: {
        // The admin rich editor and the PDF renderer are large; keep chunks
        // digestible so shared hosting serves them fine.
        chunkSizeWarningLimit: 1600,
        rollupOptions: {
            output: {
                manualChunks: {
                    pdf: ['@react-pdf/renderer'],
                    editor: ['@mdxeditor/editor'],
                    vendor: ['react', 'react-dom', '@inertiajs/react'],
                },
            },
        },
    },
});
