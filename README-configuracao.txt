JVM ELETRÔNICOS - CONFIGURAÇÃO DO ADMIN
======================================

1. Coloque estes arquivos na raiz, junto de:
   index.html
   style.css
   main.js
   firebase-config.js
   logo-jvm.png

   Novos:
   admin.html
   admin.css
   admin.js

2. Firebase Authentication:
   Authentication > Sign-in method > Email/Password > Ativar.

3. Primeiro administrador:
   - Cadastre uma conta normalmente.
   - Abra Firestore > usuarios > documento do usuário.
   - Troque perfil de "cliente" para "admin".
   - Faça isso manualmente no Console somente para o primeiro admin.

4. Firestore:
   Firestore Database > Rules
   Cole o conteúdo de firestore.rules e publique.

5. Storage:
   Storage > Rules
   Cole storage.rules e publique.

6. IMPORTANTE SOBRE firebase-config.js:
   Seu arquivo atual não possui storageBucket.
   Para upload de imagens pelo computador funcionar, copie o valor EXATO em:
   Project settings > General > Your apps > SDK setup and configuration
   e adicione:
   storageBucket: "VALOR_EXATO_DO_SEU_PROJETO"

7. Domínio:
   Authentication > Settings > Authorized domains
   confirme seu domínio do GitHub Pages, por exemplo:
   seuusuario.github.io

8. Segurança:
   Remova do seu main.js a função:
   promoverUsuarioParaAdmin()

   As regras deste pacote também bloqueiam a autopromoção de cliente para admin.

9. Teste:
   - Conta admin: /admin.html deve abrir o painel.
   - Conta cliente: /admin.html deve mostrar acesso não autorizado.
   - Sem login: /admin.html mostra o formulário de login.
