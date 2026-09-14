# Envio em Massa WhatsApp Web

App que envia mensagens do WhatsApp para vários números de uma vez, controlado
totalmente pelo navegador. O operador abre o link do app, escaneia o QR Code uma
vez e envia as mensagens (com envio do PDF junto na Mensagem 3).

## Arquivos
- server.js - o robo (Node.js)
- public/index.html - a tela usada no navegador
- package.json - dependencias

## Como usar (apos publicado)
1. Abra o link do app no navegador.
2. Escaneie o QR Code com o celular (WhatsApp > Aparelhos conectados > Conectar um aparelho).
3. Cole os numeros (um por linha) ou carregue a planilha Excel.
4. Escolha a mensagem (1, 2 ou 3) e clique em Enviar.
5. Na Mensagem 3, selecione tambem o PDF para ser enviado junto.

## Dicas
- Intervalo entre envios: use 10s ou mais para evitar bloqueios do WhatsApp.
- Numeros sem DDD recebem o DDD padrao (61), que pode ser mudado na tela.
- O login fica salvo, entao o QR Code so e pedido na primeira vez.
