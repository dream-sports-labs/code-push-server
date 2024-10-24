# Use an official Node.js runtime as a parent image
FROM node:14-alpine

# Set the working directory inside the container
WORKDIR /code-push-server/api

# Copy the package.json and package-lock.json from the 'api' folder in your local system
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Install Azurite globally (if needed for local development)
RUN npm install -g azurite

# Copy the rest of the application code from the 'api' folder in your local system
COPY . .

# Set up the .env file (default values)
RUN echo "EMULATED=true\nPORT=3000" > .env

# Build the CodePush server
RUN npm run build

# Expose the port that your app will run on (based on the .env file)
EXPOSE 3000

# Start Azurite and the CodePush server
CMD ["sh", "-c", "npm run start:env && node seedData.js"]