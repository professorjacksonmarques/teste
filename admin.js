let usuarioAtual = null;
let perfilAtual = null;
let produtosCache = [];
let usuariosCache = [];

const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

document.addEventListener("DOMContentLoaded", () => {
  registrarEventos();
});

function registrarEventos() {
  document.getElementById("admin-login-form")?.addEventListener("submit", loginAdmin);
  document.getElementById("toggle-senha")?.addEventListener("click", alternarSenha);
  document.getElementById("btn-admin-logout")?.addEventListener("click", logoutAdmin);
  document.getElementById("btn-negado-logout")?.addEventListener("click", logoutAdmin);

  document.getElementById("btn-novo-produto")?.addEventListener("click", mostrarFormulario);
  document.getElementById("btn-cancelar-produto")?.addEventListener("click", cancelarFormulario);
  document.getElementById("produto-form")?.addEventListener("submit", salvarProduto);
  document.getElementById("tipoImagem")?.addEventListener("change", alternarEntradaImagem);

  document.getElementById("lista-produtos")?.addEventListener("click", event => {
    const editar = event.target.closest("[data-editar]");
    const excluir = event.target.closest("[data-excluir]");

    if (editar) editarProduto(editar.dataset.editar);
    if (excluir) excluirProduto(excluir.dataset.excluir);
  });

  document.getElementById("lista-usuarios")?.addEventListener("click", event => {
    const promover = event.target.closest("[data-promover]");
    const rebaixar = event.target.closest("[data-rebaixar]");

    if (promover) alterarPerfilUsuario(promover.dataset.promover, "admin");
    if (rebaixar) alterarPerfilUsuario(rebaixar.dataset.rebaixar, "cliente");
  });
}

/* ===================== AUTENTICAÇÃO ===================== */

auth.onAuthStateChanged(async user => {
  ocultarEstados();

  if (!user) {
    usuarioAtual = null;
    perfilAtual = null;
    mostrarLogin();
    return;
  }

  usuarioAtual = user;
  mostrarLoading();

  try {
    const doc = await db.collection("usuarios").doc(user.uid).get();

    if (!doc.exists || doc.data().perfil !== "admin") {
      perfilAtual = doc.exists ? doc.data().perfil : null;
      mostrarAcessoNegado(user.email || "");
      return;
    }

    perfilAtual = "admin";
    mostrarPainel(user.email || "");

    await Promise.all([
      carregarProdutos(),
      carregarUsuarios()
    ]);
  } catch (error) {
    console.error("Erro ao validar perfil:", error);
    await auth.signOut();
    mostrarLogin();
    mostrarLoginMensagem(
      "Não foi possível validar seu perfil no Firestore. Confira as regras de segurança.",
      "danger"
    );
  }
});

async function loginAdmin(event) {
  event.preventDefault();

  const email = document.getElementById("admin-email").value.trim();
  const senha = document.getElementById("admin-senha").value;
  const botao = document.getElementById("btn-admin-login");

  if (!email || !senha) {
    mostrarLoginMensagem("Informe o e-mail e a senha.", "warning");
    return;
  }

  setBotaoCarregando(botao, true, "Entrando...");

  try {
    await auth.signInWithEmailAndPassword(email, senha);
  } catch (error) {
    console.error("Falha no login:", error);
    mostrarLoginMensagem(traduzirErroAuth(error.code), "danger");
  } finally {
    setBotaoCarregando(botao, false);
  }
}

async function logoutAdmin() {
  await auth.signOut();
}

function alternarSenha() {
  const input = document.getElementById("admin-senha");
  const icone = document.querySelector("#toggle-senha i");
  const exibindo = input.type === "text";

  input.type = exibindo ? "password" : "text";
  if (icone) icone.className = exibindo ? "bi bi-eye" : "bi bi-eye-slash";
}

function ocultarEstados() {
  ["auth-loading", "admin-login", "acesso-negado", "admin-panel"].forEach(id => {
    document.getElementById(id)?.classList.add("d-none");
  });
}

function mostrarLoading() {
  ocultarEstados();
  document.getElementById("auth-loading")?.classList.remove("d-none");
}

function mostrarLogin() {
  ocultarEstados();
  document.getElementById("admin-login")?.classList.remove("d-none");
}

function mostrarAcessoNegado(email) {
  ocultarEstados();
  document.getElementById("email-negado").textContent = email || "usuário atual";
  document.getElementById("acesso-negado")?.classList.remove("d-none");
}

function mostrarPainel(email) {
  ocultarEstados();
  document.getElementById("admin-user-email").textContent = email || "Administrador";
  document.getElementById("admin-panel")?.classList.remove("d-none");
}

/* ===================== PRODUTOS ===================== */

async function carregarProdutos() {
  try {
    const snapshot = await db.collection("produtos").get();

    produtosCache = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
      );

    renderizarProdutos();
    atualizarEstatisticas();
  } catch (error) {
    console.error("Erro ao carregar produtos:", error);
    mostrarMensagem("Erro ao carregar produtos.", "danger");
  }
}

function renderizarProdutos() {
  const tbody = document.getElementById("lista-produtos");

  tbody.innerHTML = produtosCache.map(produto => {
    const preco = numero(produto.preco);
    const promocional = numero(produto.precoPromocional);
    const precoVenda = promocional > 0 && promocional < preco ? promocional : preco;
    const estoque = Math.max(0, parseInt(produto.estoque, 10) || 0);
    const ativo = produto.ativo !== false;
    const imagem = imagemSegura(produto.imagem);

    return `
      <tr>
        <td>
          <div class="prod-cell">
            <img
              src="${escapeAttr(imagem)}"
              class="prod-thumb"
              alt="${escapeAttr(produto.nome || "Produto")}"
              onerror="this.src='https://placehold.co/120x120/f4f7fb/0b3977?text=JVM'"
            >
            <div>
              <div class="prod-name">${escapeHTML(produto.nome || "Produto sem nome")}</div>
              <small class="text-secondary">${escapeHTML(produto.marca || "Sem marca")}</small>
            </div>
          </div>
        </td>
        <td>${escapeHTML(produto.categoria || "Eletrônicos")}</td>
        <td>
          <strong>${moedaBRL.format(precoVenda)}</strong>
          ${
            promocional > 0 && promocional < preco
              ? `<div><small class="text-secondary"><s>${moedaBRL.format(preco)}</s></small></div>`
              : ""
          }
        </td>
        <td class="${estoque <= 3 ? "text-danger fw-bold" : ""}">${estoque}</td>
        <td>
          <span class="badge-status ${ativo ? "status-on" : "status-off"}">
            ${ativo ? "Ativo" : "Inativo"}
          </span>
        </td>
        <td class="text-end text-nowrap">
          <button
            class="btn btn-sm btn-outline-primary me-1"
            type="button"
            data-editar="${escapeAttr(produto.id)}"
          >
            <i class="bi bi-pencil"></i>
          </button>
          <button
            class="btn btn-sm btn-outline-danger"
            type="button"
            data-excluir="${escapeAttr(produto.id)}"
          >
            <i class="bi bi-trash3"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function mostrarFormulario() {
  limparFormulario();
  document.getElementById("form-produto")?.classList.remove("d-none");
  document.getElementById("nome")?.focus();
}

function cancelarFormulario() {
  document.getElementById("form-produto")?.classList.add("d-none");
  limparFormulario();
}

function limparFormulario() {
  document.getElementById("produto-form")?.reset();
  setValor("id-produto", "");
  setValor("categoria", "");
  setValor("marca", "");
  setValor("precoPromocional", "");
  setValor("descricao", "");
  setValor("imagemURL", "");

  const ativo = document.getElementById("ativo");
  if (ativo) ativo.checked = true;

  const tipoImagem = document.getElementById("tipoImagem");
  if (tipoImagem) tipoImagem.value = "url";

  alternarEntradaImagem();
}

function alternarEntradaImagem() {
  const tipo = document.getElementById("tipoImagem")?.value || "url";

  document
    .getElementById("grupo-imagem-url")
    ?.classList.toggle("d-none", tipo !== "url");

  document
    .getElementById("grupo-imagem-arquivo")
    ?.classList.toggle("d-none", tipo !== "arquivo");
}

async function salvarProduto(event) {
  event.preventDefault();

  if (!usuarioAtual || perfilAtual !== "admin") {
    mostrarMensagem("Sessão administrativa inválida.", "danger");
    return;
  }

  const id = document.getElementById("id-produto").value;
  const nome = document.getElementById("nome").value.trim();
  const categoria = document.getElementById("categoria").value.trim() || "Eletrônicos";
  const marca = document.getElementById("marca").value.trim();
  const preco = parseFloat(document.getElementById("preco").value);
  const promoTexto = document.getElementById("precoPromocional").value;
  const precoPromocional = promoTexto ? parseFloat(promoTexto) : null;
  const estoque = parseInt(document.getElementById("estoque").value, 10);
  const descricao = document.getElementById("descricao").value.trim();

  const destaque = document.getElementById("destaque").checked;
  const maisVendido = document.getElementById("maisVendido").checked;
  const ativo = document.getElementById("ativo").checked;

  const tipoImagem = document.getElementById("tipoImagem").value;
  const imagemURL = document.getElementById("imagemURL").value.trim();
  const imagemArquivo = document.getElementById("imagemArquivo").files[0];
  const botao = document.getElementById("btn-salvar-produto");

  if (!nome || !Number.isFinite(preco) || preco < 0 || !Number.isInteger(estoque) || estoque < 0) {
    mostrarMensagem("Preencha corretamente nome, preço e estoque.", "warning");
    return;
  }

  if (
    precoPromocional !== null &&
    (!Number.isFinite(precoPromocional) ||
      precoPromocional < 0 ||
      precoPromocional >= preco)
  ) {
    mostrarMensagem("O preço promocional deve ser menor que o preço normal.", "warning");
    return;
  }

  setBotaoCarregando(botao, true, "Salvando...");

  try {
    const produtoAtual = produtosCache.find(p => p.id === id);
    let imagem = imagemURL || produtoAtual?.imagem || "";

    if (tipoImagem === "arquivo" && imagemArquivo) {
      imagem = await enviarImagem(imagemArquivo);
    }

    const dados = {
      nome,
      categoria,
      marca,
      preco,
      precoPromocional,
      estoque,
      imagem,
      descricao,
      destaque,
      maisVendido,
      ativo,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
      await db.collection("produtos").doc(id).update(dados);
      mostrarMensagem("Produto atualizado com sucesso.", "success");
    } else {
      dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("produtos").add(dados);
      mostrarMensagem("Produto adicionado com sucesso.", "success");
    }

    cancelarFormulario();
    await carregarProdutos();
  } catch (error) {
    console.error("Erro ao salvar produto:", error);
    mostrarMensagem(
      "Não foi possível salvar o produto. Se estiver enviando arquivo, confira o Firebase Storage.",
      "danger"
    );
  } finally {
    setBotaoCarregando(botao, false);
  }
}

async function editarProduto(id) {
  const produto = produtosCache.find(p => p.id === id);
  if (!produto) return;

  setValor("id-produto", produto.id);
  setValor("nome", produto.nome || "");
  setValor("categoria", produto.categoria || "");
  setValor("marca", produto.marca || "");
  setValor("preco", numero(produto.preco));
  setValor("precoPromocional", produto.precoPromocional ?? "");
  setValor("estoque", Math.max(0, parseInt(produto.estoque, 10) || 0));
  setValor("descricao", produto.descricao || "");
  setValor("imagemURL", produto.imagem || "");

  document.getElementById("destaque").checked = produto.destaque === true;
  document.getElementById("maisVendido").checked = produto.maisVendido === true;
  document.getElementById("ativo").checked = produto.ativo !== false;
  document.getElementById("tipoImagem").value = "url";

  alternarEntradaImagem();
  document.getElementById("form-produto")?.classList.remove("d-none");
  document.getElementById("form-produto")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function excluirProduto(id) {
  const produto = produtosCache.find(p => p.id === id);
  if (!confirm(`Deseja excluir "${produto?.nome || "este produto"}"?`)) return;

  try {
    await db.collection("produtos").doc(id).delete();
    mostrarMensagem("Produto excluído.", "success");
    await carregarProdutos();
  } catch (error) {
    console.error(error);
    mostrarMensagem("Não foi possível excluir o produto.", "danger");
  }
}

async function enviarImagem(arquivo) {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Arquivo inválido.");
  }

  if (arquivo.size > 5 * 1024 * 1024) {
    throw new Error("Imagem maior que 5 MB.");
  }

  const nome = arquivo.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");

  const ref = storage.ref(`produtos/${Date.now()}-${nome}`);
  const snapshot = await ref.put(arquivo);
  return snapshot.ref.getDownloadURL();
}

/* ===================== USUÁRIOS ===================== */

async function carregarUsuarios() {
  try {
    const snapshot = await db.collection("usuarios").get();

    usuariosCache = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) =>
        String(a.email || "").localeCompare(String(b.email || ""), "pt-BR")
      );

    renderizarUsuarios();
    atualizarEstatisticas();
  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
    mostrarMensagem("Erro ao carregar usuários.", "danger");
  }
}

function renderizarUsuarios() {
  const tbody = document.getElementById("lista-usuarios");

  tbody.innerHTML = usuariosCache.map(usuario => {
    const isAdmin = usuario.perfil === "admin";
    const isAtual = usuario.id === usuarioAtual?.uid;

    return `
      <tr>
        <td>
          <strong>${escapeHTML(usuario.email || "E-mail não disponível")}</strong>
          ${isAtual ? '<div><small class="text-secondary">Sua conta</small></div>' : ""}
        </td>
        <td>
          <span class="badge-role ${isAdmin ? "role-admin" : "role-client"}">
            ${isAdmin ? "Administrador" : "Cliente"}
          </span>
        </td>
        <td class="text-end">
          ${
            isAtual
              ? '<small class="text-secondary">Conta atual</small>'
              : isAdmin
                ? `<button class="btn btn-sm btn-outline-secondary" type="button"
                     data-rebaixar="${escapeAttr(usuario.id)}">Remover admin</button>`
                : `<button class="btn btn-sm btn-outline-primary" type="button"
                     data-promover="${escapeAttr(usuario.id)}">Tornar admin</button>`
          }
        </td>
      </tr>
    `;
  }).join("");
}

async function alterarPerfilUsuario(uid, perfil) {
  if (!usuarioAtual || perfilAtual !== "admin") return;

  if (uid === usuarioAtual.uid) {
    mostrarMensagem("Você não pode alterar seu próprio perfil neste painel.", "warning");
    return;
  }

  const usuario = usuariosCache.find(u => u.id === uid);
  const texto =
    perfil === "admin"
      ? `Tornar ${usuario?.email || "este usuário"} administrador?`
      : `Remover a permissão de administrador de ${usuario?.email || "este usuário"}?`;

  if (!confirm(texto)) return;

  try {
    await db.collection("usuarios").doc(uid).update({
      perfil,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    mostrarMensagem("Permissão atualizada.", "success");
    await carregarUsuarios();
  } catch (error) {
    console.error(error);
    mostrarMensagem("Não foi possível alterar a permissão.", "danger");
  }
}

/* ===================== UTILITÁRIOS ===================== */

function atualizarEstatisticas() {
  setTexto("stat-produtos", produtosCache.length);
  setTexto(
    "stat-estoque-baixo",
    produtosCache.filter(p => (parseInt(p.estoque, 10) || 0) <= 3).length
  );
  setTexto("stat-usuarios", usuariosCache.length);
  setTexto("stat-admins", usuariosCache.filter(u => u.perfil === "admin").length);
}

function mostrarMensagem(texto, tipo = "info") {
  const el = document.getElementById("mensagem");
  if (!el) return;

  el.className = `alert alert-${tipo}`;
  el.textContent = texto;
  el.classList.remove("d-none");

  clearTimeout(mostrarMensagem.timer);
  mostrarMensagem.timer = setTimeout(() => el.classList.add("d-none"), 4500);
}

function mostrarLoginMensagem(texto, tipo = "danger") {
  const el = document.getElementById("login-mensagem");
  if (!el) return;

  el.className = `alert alert-${tipo}`;
  el.textContent = texto;
  el.classList.toggle("d-none", !texto);
}

function setBotaoCarregando(botao, carregando, texto = "Aguarde...") {
  if (!botao) return;

  if (carregando) {
    botao.dataset.original = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${escapeHTML(texto)}`;
  } else {
    botao.disabled = false;
    if (botao.dataset.original) {
      botao.innerHTML = botao.dataset.original;
      delete botao.dataset.original;
    }
  }
}

function setValor(id, valor) {
  const el = document.getElementById(id);
  if (el) el.value = valor ?? "";
}

function setTexto(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(valor ?? "");
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function imagemSegura(url) {
  const valor = String(url || "").trim();

  return /^https?:\/\//i.test(valor)
    ? valor
    : "https://placehold.co/120x120/f4f7fb/0b3977?text=JVM";
}

function traduzirErroAuth(codigo) {
  const erros = {
    "auth/invalid-email": "O e-mail informado é inválido.",
    "auth/user-disabled": "Esta conta está desativada.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-login-credentials": "E-mail ou senha inválidos.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde e tente novamente.",
    "auth/network-request-failed": "Falha de conexão com o Firebase."
  };

  return erros[codigo] || "Não foi possível entrar. Verifique o e-mail e a senha.";
}

function escapeHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(valor) {
  return escapeHTML(valor);
}
