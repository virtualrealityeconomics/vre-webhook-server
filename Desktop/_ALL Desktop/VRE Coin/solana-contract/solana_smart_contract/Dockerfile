# Use Node.js base image
FROM node:18

# Install system dependencies
RUN apt-get update && apt-get install -y curl

# Install Solana CLI with better error handling
RUN curl -sSfL https://release.solana.com/v1.18.15/install | sh && \
    ls -la /root/.local/share/solana/install/active_release/bin/ && \
    chmod +x /root/.local/share/solana/install/active_release/bin/* && \
    /root/.local/share/solana/install/active_release/bin/spl-token --version

# Add Solana CLI to PATH
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Create symlinks for easier access
RUN ln -sf /root/.local/share/solana/install/active_release/bin/spl-token /usr/local/bin/spl-token && \
    ln -sf /root/.local/share/solana/install/active_release/bin/solana /usr/local/bin/solana

# Final verification
RUN spl-token --version && echo "✅ Solana CLI installed successfully"

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