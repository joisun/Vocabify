# WXT + React

This template should help get you started developing with React in WXT.


手动引入了 shadcn:
https://ui.shadcn.com/docs/installation/manual



---
# Vocabify - Your Smart Vocabulary Learning Assistant

<p align="center">
  <img src="path/to/your/logo.png" alt="Vocabify Logo" width="200"/>
</p>

Vocabify is a premium browser extension that helps you learn and manage vocabulary while browsing the web. With AI-powered explanations and smart organization features, it makes vocabulary learning seamless and efficient.

## ✨ Features

### 🎯 Smart Text Selection
- Select any text on a webpage to get instant vocabulary assistance
- Intelligent context detection to avoid invalid selections
- Customizable highlight styles

### 🤖 AI-Powered Explanations
- Multiple AI service providers support (ChatAnywhere, Kimi, XunfeiSpark, OpenAI)
- Customizable explanation templates
- Multi-language support
- Real-time explanation generation

### 📚 Vocabulary Management
- Side panel for easy access to saved vocabulary
- Search and filter capabilities
- Edit and update explanations
- Expandable detailed view
- Pagination support

### ⚙️ Customization Options
- Customizable highlight styles (color, type, thickness)
- Target language selection
- AI API key configuration
- Dark/Light theme support

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/vocabify.git
```

2. Install dependencies:
```bash
pnpm install
```

3. Development mode:
```bash
pnpm dev              # For Chrome
pnpm dev:firefox      # For Firefox
```

4. Build for production:
```bash
pnpm build            # For Chrome
pnpm build:firefox    # For Firefox
```

## 🛒 Chrome Web Store

Vocabify is available on the Chrome Web Store as a premium extension. Enjoy a 7-day free trial and unlock all features with a subscription.

[![Chrome Web Store](path/to/chrome-web-store-badge.png)](https://chrome.google.com/webstore/detail/vocabify/your-extension-id)

## 🔧 Configuration

### AI Service Setup

1. Open the extension options
2. Navigate to "API Keys Configuration"
3. Add your API keys for supported services:
   - ChatAnywhere
   - Kimi
   - XunfeiSpark
   - OpenAI

### Customizing Templates

1. Go to extension options
2. Find "Prompt Template" section
3. Customize the template using available placeholders:
   - `#SELECTION#`: Selected text
   - `#LANGUAGE#`: Target language

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [WXT](https://wxt.dev/) - Browser Extension Framework
- [shadcn/ui](https://ui.shadcn.com/) - UI Components
- **Tailwind CSS** - Styling Framework

## 📞 Contact

- Project Link: [https://github.com/yourusername/vocabify](https://github.com/yourusername/vocabify)
- Author: Your Name
- Email: your.email@example.com

---

<p align="center">Made with ❤️ for vocabulary learners everywhere</p>