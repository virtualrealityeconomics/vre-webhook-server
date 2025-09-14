# Use Node.js base image
FROM node:18

# Install Solana CLI
RUN curl -sSfL https://release.solana.com/v1.18.15/install | sh
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]