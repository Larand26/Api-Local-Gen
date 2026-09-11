# --- ETAPA 1: Build (Compilação) ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copia os manifests de dependências
COPY package*.json ./

# Instala todas as dependências necessárias para o build (incluindo devDependencies)
RUN npm install

# Copia o código-fonte do projeto
COPY . .

# Executa a compilação (tsc && node scripts/copy-assets.js)
RUN npm run build

# --- ETAPA 2: Execução (Produção) ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copia manifests e instala apenas as dependências de produção
COPY package*.json ./
RUN npm install --omit=dev

# Copia o resultado do build gerado na etapa 1
COPY --from=builder /app/dist ./dist

# Expõe a porta padrão da API (ajuste caso use outra)
EXPOSE 3000

# Executa o comando de inicialização (node dist/server.js)
CMD ["npm", "start"]