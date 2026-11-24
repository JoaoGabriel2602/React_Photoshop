import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy da geração de imagem por I.A.
//
// O navegador chama   /api/ai-image/<texto>?width=...&height=...&seed=...
// O servidor do Vite repassa para   https://gen.pollinations.ai/image/<texto>?...
// e acrescenta a chave no cabeçalho Authorization. Assim a chave NUNCA vai para o navegador.
export default defineConfig(({ mode }) => {
  // O 3º argumento '' carrega TODAS as variáveis do .env.local (não só as que começam com VITE_).
  // Isso é o que mantém a chave só no servidor.
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.POLLINATIONS_API_KEY

  if (!apiKey) {
    console.warn(
      '\n[ai-image] POLLINATIONS_API_KEY não encontrada. Crie o arquivo .env.local na raiz do projeto ' +
        'e reinicie o servidor.\n',
    )
  }

  const aiProxy = {
    '/api/ai-image': {
      target: 'https://gen.pollinations.ai',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/ai-image/, '/image'),
      headers: { Authorization: `Bearer ${apiKey ?? ''}` },
      timeout: 90_000, // a geração pode demorar
      proxyTimeout: 90_000,
    },
  }

  return {
    plugins: [react()],
    server: { proxy: aiProxy }, // npm run dev
    preview: { proxy: aiProxy }, // npm run preview
  }
})