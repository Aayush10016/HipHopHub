import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend port — override with VITE_API_PORT env variable if needed.
// The backend defaults to 8080 but may run on other ports (8085, etc.)
const apiPort = process.env.VITE_API_PORT || '8085'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: `http://localhost:${apiPort}`,
                changeOrigin: true,
                secure: false,
            }
        }
    }
})

