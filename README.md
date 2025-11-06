# AltVision - Extensão para Geração Automática de Descrições de Imagens

## 🧩 Como Usar
1. Faça o download ou clone este repositório em seu computador.  
2. Abra o arquivo `background.js` e substitua o valor:
   ```js
   const OPENAI_API_KEY = "<INSIRA_SUA_CHAVE_AQUI>";
   ```
pela sua chave pessoal da OpenAI API (Pode criar uma na sua conta OpenAI de forma gratuita com plano limitado).

> ⚠️ Importante: nunca publique sua chave real em repositórios públicos.

3. No navegador Google Chrome, acesse:
```arduino
chrome://extensions
```
4. Ative o Modo Desenvolvedor (canto superior direito).

5. Clique em “Carregar sem compactar” e selecione a pasta do projeto.

6. O ícone da extensão aparecerá na barra de ferramentas.
Basta abrir uma página com imagens e clicar em “Analisar Imagens” para gerar as descrições.

## Sobre o Projeto
O AltVision é uma extensão para o navegador Google Chrome desenvolvida com o objetivo de contribuir para uma web mais acessível.
A ferramenta identifica imagens sem texto alternativo (alt) e gera automaticamente descrições curtas e objetivas em português, utilizando Inteligência Artificial e vsão computacional.

O projeto é um MVP funcional, voltado para demonstrar a integração entre front-end, APIs de IA e boas práticas de acessibilidade digital.

## ⚙️ Tecnologias Utilizadas
- **JavaScript** (ES6+) – Lógica principal da extensão e integração com a API.
- **Chrome Extensions API** (Manifest v3) – Comunicação entre popup, conteúdo e background.
- **HTML5** e **CSS3** – Interface leve e responsiva.
- **OpenAI API** (GPT-4o-mini) – Geração automática das descrições de imagens.
- **Armazenamento Local** (chrome.storage) – Cache e controle de limite de uso.

## Uso de Inteligência Artificial
A IA é utilizada no núcleo da funcionalidade da extensão:
cada imagem é enviada para o modelo GPT-4o-mini, que interpreta o conteúdo visual e retorna uma legenda curta e descritiva.

A escolha desse modelo se deve ao seu baixo custo, bom desempenho visual e suporte em português, permitindo uma aplicação acessível e eficiente para fins educacionais e de demonstração técnica.

## 🚀 Evoluções Futuras
Após a validação do MVP, as próximas iterações planejadas incluem:

- Refinamento das descrições com modelos mais contextuais e maior qualidade semântica.
- Criação de um painel de histórico e personalização de parâmetros da IA.
- Suporte a análise de múltiplas páginas e novas fontes de dados visuais.
- Migração futura para Manifest v4 e arquitetura mais modular.

📍 Autora: Ana Cristina Vaz de Azevedo
🎯 Objetivo: Demonstrar aplicação prática de IA generativa em soluções acessíveis e úteis.
