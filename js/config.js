/**
 * Configuration file for secure backend architecture
 * IMPORTANT: API keys are handled securely via Supabase Edge Functions
 * No client-side API key storage - all AI features use secure backend
 */

class Config {
    constructor() {
        // No API keys stored client-side - using secure backend
        this.emailConfig = {
            service: 'gmail', // or other email service
            user: null,
            password: null // Use app-specific password for Gmail
        };
    }

    /**
     * Check if AI features are available (always true with secure backend)
     */
    isAIAvailable() {
        return true; // AI features work through secure backend
    }

    /**
     * Show AI features information
     */
    showSetupInstructions() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2>🤖 AI Features Ready</h2>

                <h3>Secure AI-Powered Resume Tailoring</h3>
                <p>AI features are ready to use! This platform uses secure backend processing:</p>
                <ul>
                    <li>✅ <strong>No API keys required</strong> - handled securely on the server</li>
                    <li>✅ <strong>Zero client-side storage</strong> - your data stays protected</li>
                    <li>✅ <strong>Enterprise-grade security</strong> - powered by Supabase Edge Functions</li>
                    <li>✅ <strong>GPT-4o-mini</strong> - latest AI model for resume optimization</li>
                </ul>

                <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #10b981;">
                    <strong>🛡️ Security First:</strong> All AI processing happens on secure servers. No API keys are stored in your browser or exposed to client-side code.
                </div>

                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="this.parentElement.parentElement.remove()" class="btn-primary">Start Using AI Features</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Show message to user
     */
    showMessage(text, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 300px;
            background-color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#0066cc'};
        `;
        messageDiv.textContent = text;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    }
}

// Create global config instance
window.config = new Config();