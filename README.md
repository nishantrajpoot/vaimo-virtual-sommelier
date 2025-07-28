# Delhaize Wine Sommelier

A virtual wine sommelier with AI-powered recommendations, food pairings, and expert wine advice in French, English, and Dutch.

## Features

- 🍷 **AI-Powered Recommendations** - Get personalized wine suggestions based on preferences, budget, and occasion
- 🌍 **Multi-Language Support** - Available in French, English, and Dutch
- 🛒 **Smart Cart Integration** - Add wines to cart and get direct links to Delhaize
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎯 **Dynamic Suggestions** - Learn from user queries to provide better suggestions

## Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <your-repo-url>
   cd wine-sommelier-agent
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`
   
   Edit `.env.local` and add your OpenAI API key:
   \`\`\`env
   OPENAI_API_KEY=your_openai_api_key_here
   \`\`\`

4. **Run the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key for AI-powered responses | Yes |

### Getting an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key to your `.env.local` file

## Usage

1. **Open the chatbot** by clicking the wine icon in the bottom right
2. **Select your language** (FR/EN/NL) from the dropdown
3. **Ask questions** about wine recommendations, food pairings, or wine advice
4. **Add wines to cart** by viewing wine details and clicking "Add to Cart"
5. **View your cart** using the green cart icon (appears when you have items)
6. **Shop on Delhaize** using direct wine links or the shopping list feature

## Features

### AI Sommelier
- Personalized wine recommendations
- Food pairing suggestions
- Wine knowledge and advice
- Multi-language support

### Smart Cart
- Add recommended wines to cart
- Direct links to Delhaize wine pages
- Shopping list generation
- Cart persistence across sessions

### Dynamic Learning
- Learns from user queries
- Improves suggestions over time
- Grammar and style enhancement
- Language-specific optimizations

## Deployment

### Vercel (Recommended)

1. **Push to GitHub** (make sure `.env.local` is in `.gitignore`)
2. **Connect to Vercel**
3. **Add environment variables** in Vercel dashboard
4. **Deploy**

### Other Platforms

Make sure to:
- Set the `OPENAI_API_KEY` environment variable
- Use Node.js 18+
- Build command: `npm run build`
- Start command: `npm start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Security

- **Never commit API keys** to version control
- **Use environment variables** for all secrets
- **Keep dependencies updated**
- **Follow security best practices**

## License

This project is licensed under the MIT License.
