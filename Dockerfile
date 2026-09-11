# --- ETAPA 1: Build (Compilação) ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copia os manifests de dependências
COPY package*.json ./

# Instala todas as dependências (inclusive devDependencies para o tsc)
RUN npm install

# Copia o código-fonte e compila (tsc + scripts/copy-assets.js)
COPY . .
RUN npm run build

# --- ETAPA 2: Execução (Produção) ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copia manifests e instala apenas dependências de produção
COPY package*.json ./
RUN npm install --omit=dev

# Copia o build e arquivos gerados da etapa anterior
COPY --from=builder /app/dist ./dist

# Caso seu script scripts/copy-assets.js copie algo para fora de dist,
# certifique-se de que foi copiado ou exponha a porta da sua API aqui:
EXPOSE 3000

# Inicia a aplicação usando o script start configurado
CMD ["npm", "start"]