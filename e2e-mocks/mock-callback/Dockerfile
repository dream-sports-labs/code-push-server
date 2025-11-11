FROM node:18-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY mock_data.js ./
COPY routes/ ./routes/
COPY utils/ ./utils/
RUN npm install
# Create storage directory for uploaded packages
RUN mkdir -p /tmp/codepush-packages
EXPOSE 3001
CMD ["npm", "start"]

