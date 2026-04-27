# KiAgenda Assistente Extension

Base inicial da extensao Google Chrome da versao Essencial do KiAgenda Assistente.

## O que esta incluido

- popup simples com acesso rapido
- pagina completa de configuracoes em `options.html`
- salvamento em `chrome.storage.local`
- botao `Upgrade para Nuvem`
- `content.js` preparado para rodar no WhatsApp Web
- `background.js` simples com estrutura inicial
- Manifest V3

## Como carregar no Chrome

1. Abra `chrome://extensions`
2. Ative o `Modo do desenvolvedor`
3. Clique em `Carregar sem compactacao`
4. Selecione a pasta `extension`

## Estrutura

- `manifest.json`: configuracao da extensao
- `popup.html`: acesso rapido da extensao
- `popup.js`: abre configuracoes e upgrade
- `options.html`: painel de configuracoes da extensao
- `options.js`: logica local de negocio, mensagens, itens, links e simulador
- `content.js`: script carregado no WhatsApp Web
- `background.js`: service worker da extensao
- `style.css`: visual do popup e da tela de configuracoes
- `icons/`: pasta reservada para icones da extensao

## Nao implementado nesta etapa

- IA
- envio de midia
- envio automatico real
- integracao com nuvem
- login
