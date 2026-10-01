let usuarioAtual = null;
let produtosOriginais = [];
let categoriaAtual = "todos";

let carrinho = carregarCarrinhoLocal();

const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

document.addEventListener("DOMContentLoaded", () => {
  registrarEventos();
  renderizarCarrinho();
  carregarProdutos();

  const ano = document.getElementById("ano-atual");
  if (ano) ano.textContent = new Date().getFullYear();
});

function registrarEventos() {
  document.getElementById("btn-login")?.addEventListener("click", abrirLogin);
  document.getElementById("btn-logout")?.addEventListener("click", logout);
  document.getElementById("btn-admin")?.addEventListener("click", () => {
    window.location.href = "admin.html";
  });

  document.getElementById("btn-entrar-modal")?.addEventListener("click", login);
  document.getElementById("btn-cadastrar")?.addEventListener("click", cadastrar);
  document.getElementById("btn-finalizar")?.addEventListener("click", finalizarCompra);

  document.getElementById("busca")?.addEventListener("input", aplicarFiltros);
  document.getElementById("ordenacao")?.addEventListener("change", aplicarFiltros);

  document.getElementById("category-nav")?.addEventListener("click", event => {
    const botao = event.target.closest("[data-category]");
    if (!botao) return;

    categoriaAtual = botao.dataset.category || "todos";

    document.querySelectorAll(".category-link").forEach(el => {
      el.classList.toggle("active", el === botao);
    });

    const titulo = document.getElementById("titulo-produtos");
    if (titulo) {
      titulo.textContent =
        categoriaAtual === "todos"
          ? "Ofertas e destaques"
          : categoriaAtual;
    }

    aplicarFiltros();
  });

  document.getElementById("produtos")?.addEventListener("click", event => {
    const botao = event.target.closest("[data-add-cart]");
    if (!botao) return;
    adicionarAoCarrinho(botao.dataset.addCart);
  });

  document.getElementById("carrinho")?.addEventListener("click", event => {
    const aumentar = event.target.closest("[data-cart-plus]");
    const diminuir = event.target.closest("[data-cart-minus]");
    const remover = event.target.closest("[data-cart-remove]");

    if (aumentar) alterarQuantidade(aumentar.dataset.cartPlus, 1);
    if (diminuir) alterarQuantidade(diminuir.dataset.cartMinus, -1);
    if (remover) removerDoCarrinho(remover.dataset.cartRemove);
  });
}

function abrirLogin() {
  const modalElement = document.getElementById("loginModal");
  if (!modalElement) return;
  bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

async function login() {
  const email = document.getElementById("email")?.value.trim();
  const senha = document.getElementById("senha")?.value;

  if (!email || !senha) {
    alert("Informe seu e-mail e sua senha.");
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, senha);
    fecharModalLogin();
  } catch (error) {
    console.error(error);
    alert("Não foi possível entrar. Verifique seu e-mail e sua senha.");
  }
}

async function cadastrar() {
  const email = document.getElementById("emailCadastro")?.value.trim();
  const senha = document.getElementById("senhaCadastro")?.value;

  if (!email || !senha) {
    alert("Preencha o e-mail e a senha para criar sua conta.");
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, senha);

    await db.collection("usuarios").doc(cred.user.uid).set({
      email,
      perfil: "cliente",
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Cadastro realizado com sucesso!");
    fecharModalLogin();
  } catch (error) {
    console.error(error);
    alert("Não foi possível realizar o cadastro: " + traduzirErroAuth(error.code));
  }
}

function fecharModalLogin() {
  const modalElement = document.getElementById("loginModal");
  if (!modalElement) return;
  bootstrap.Modal.getOrCreateInstance(modalElement).hide();
}

async function logout() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
}

auth.onAuthStateChanged(async user => {
  usuarioAtual = user;

  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");
  const btnAdmin = document.getElementById("btn-admin");
  const textoLogin = document.getElementById("texto-login");

  btnLogin?.classList.toggle("d-none", !!user);
  btnLogout?.classList.toggle("d-none", !user);
  btnAdmin?.classList.add("d-none");

  if (!user) {
    if (textoLogin) textoLogin.textContent = "Entrar";
    return;
  }

  try {
    const doc = await db.collection("usuarios").doc(user.uid).get();
    if (doc.exists && doc.data().perfil === "admin") {
      btnAdmin?.classList.remove("d-none");
    }
  } catch (error) {
    console.error("Erro ao consultar perfil do usuário:", error);
  }
});

async function carregarProdutos() {
  mostrarMensagemProdutos("Carregando produtos...");

  try {
    const snapshot = await db.collection("produtos").get();

    produtosOriginais = snapshot.docs.map(doc => ({
      id: doc.id,
      ...normalizarProduto(doc.data())
    }));

    renderizarCategorias(produtosOriginais);
    ocultarMensagemProdutos();
    aplicarFiltros();
  } catch (error) {
    console.error("Erro ao carregar produtos:", error);
    mostrarMensagemProdutos(
      "Não foi possível carregar os produtos agora. Verifique sua conexão e as permissões do Firebase."
    );
  }
}

function normalizarProduto(produto) {
  const preco = Number(produto.preco) || 0;
  const promocional = Number(produto.precoPromocional);

  return {
    nome: produto.nome || "Produto sem nome",
    categoria: produto.categoria || "Eletrônicos",
    marca: produto.marca || "",
    preco,
    precoPromocional:
      Number.isFinite(promocional) && promocional > 0 && promocional < preco
        ? promocional
        : null,
    estoque: Math.max(0, Number(produto.estoque) || 0),
    imagem: produto.imagem || "",
    descricao: produto.descricao || "",
    destaque: produto.destaque === true,
    maisVendido: produto.maisVendido === true,
    ativo: produto.ativo !== false
  };
}

function renderizarCategorias(produtos) {
  const nav = document.getElementById("category-nav");
  if (!nav) return;

  const categorias = [
    ...new Set(
      produtos
        .filter(p => p.ativo)
        .map(p => p.categoria)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  nav.innerHTML = `
    <button class="category-link active" data-category="todos" type="button">
      <i class="bi bi-grid"></i> Todos
    </button>
    ${categorias
      .map(
        categoria => `
          <button
            class="category-link"
            data-category="${escapeAttr(categoria)}"
            type="button"
          >
            ${escapeHTML(categoria)}
          </button>
        `
      )
      .join("")}
  `;
}

function aplicarFiltros() {
  const busca = (document.getElementById("busca")?.value || "")
    .trim()
    .toLowerCase();

  const ordenacao = document.getElementById("ordenacao")?.value || "relevancia";

  let lista = produtosOriginais.filter(produto => {
    if (!produto.ativo) return false;

    const categoriaOk =
      categoriaAtual === "todos" || produto.categoria === categoriaAtual;

    const texto = [
      produto.nome,
      produto.categoria,
      produto.marca,
      produto.descricao
    ]
      .join(" ")
      .toLowerCase();

    const buscaOk = !busca || texto.includes(busca);

    return categoriaOk && buscaOk;
  });

  lista = ordenarProdutos(lista, ordenacao);
  renderizarProdutos(lista);
}

function ordenarProdutos(lista, ordenacao) {
  const copia = [...lista];

  if (ordenacao === "menor-preco") {
    return copia.sort((a, b) => obterPrecoVenda(a) - obterPrecoVenda(b));
  }

  if (ordenacao === "maior-preco") {
    return copia.sort((a, b) => obterPrecoVenda(b) - obterPrecoVenda(a));
  }

  if (ordenacao === "nome") {
    return copia.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  return copia.sort((a, b) => {
    const prioridadeA = Number(a.destaque) + Number(a.maisVendido);
    const prioridadeB = Number(b.destaque) + Number(b.maisVendido);
    return prioridadeB - prioridadeA;
  });
}

function renderizarProdutos(lista) {
  const container = document.getElementById("produtos");
  if (!container) return;

  if (!lista.length) {
    container.innerHTML = `
      <div class="col-12">
        <div class="store-message text-center">
          Nenhum produto encontrado para os filtros atuais.
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = lista
    .map(produto => {
      const precoVenda = obterPrecoVenda(produto);
      const temPromocao =
        produto.precoPromocional &&
        produto.precoPromocional < produto.preco;

      const desconto = temPromocao
        ? Math.round((1 - produto.precoPromocional / produto.preco) * 100)
        : 0;

      const imagem = imagemSegura(produto.imagem);
      const esgotado = produto.estoque <= 0;

      return `
        <div class="col">
          <article class="product-card">
            <div class="product-image-wrap">
              <img
                src="${escapeAttr(imagem)}"
                class="product-image"
                alt="${escapeAttr(produto.nome)}"
                loading="lazy"
                onerror="this.src='https://placehold.co/600x450/f4f7fb/0b3977?text=JVM+Eletr%C3%B4nicos'"
              >

              <div class="product-badges">
                <div>
                  ${
                    produto.destaque
                      ? '<span class="badge-jvm">DESTAQUE</span>'
                      : produto.maisVendido
                        ? '<span class="badge-jvm">MAIS VENDIDO</span>'
                        : ""
                  }
                </div>
                <div>
                  ${
                    desconto > 0
                      ? `<span class="badge-jvm badge-discount">-${desconto}%</span>`
                      : ""
                  }
                </div>
              </div>
            </div>

            <div class="product-body">
              <div class="product-category">
                ${escapeHTML(produto.categoria)}
              </div>

              <h2 class="product-title">
                ${escapeHTML(produto.nome)}
              </h2>

              <div class="product-stock ${esgotado ? "out" : ""}">
                ${
                  esgotado
                    ? "Produto indisponível"
                    : `${produto.estoque} unidade${produto.estoque === 1 ? "" : "s"} em estoque`
                }
              </div>

              <div class="old-price">
                ${temPromocao ? moedaBRL.format(produto.preco) : "&nbsp;"}
              </div>

              <div class="current-price">
                ${moedaBRL.format(precoVenda)}
              </div>

              <div class="price-note">
                Preço do produto. Consulte as condições de pagamento.
              </div>

              <div class="product-actions">
                <button
                  class="btn btn-jvm w-100"
                  type="button"
                  data-add-cart="${escapeAttr(produto.id)}"
                  ${esgotado ? "disabled" : ""}
                >
                  <i class="bi bi-cart-plus me-2"></i>
                  ${esgotado ? "Indisponível" : "Adicionar ao carrinho"}
                </button>
              </div>
            </div>
          </article>
        </div>
      `;
    })
    .join("");
}

function adicionarAoCarrinho(produtoId) {
  const produto = produtosOriginais.find(item => item.id === produtoId);
  if (!produto || produto.estoque <= 0) return;

  const existente = carrinho.find(item => item.id === produtoId);

  if (existente) {
    if (existente.quantidade >= produto.estoque) {
      alert("Você já adicionou ao carrinho a quantidade disponível em estoque.");
      return;
    }
    existente.quantidade += 1;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: obterPrecoVenda(produto),
      imagem: produto.imagem,
      quantidade: 1,
      estoque: produto.estoque
    });
  }

  salvarCarrinhoLocal();
  renderizarCarrinho();
}

function alterarQuantidade(produtoId, delta) {
  const item = carrinho.find(produto => produto.id === produtoId);
  if (!item) return;

  const novaQuantidade = item.quantidade + delta;

  if (novaQuantidade <= 0) {
    removerDoCarrinho(produtoId);
    return;
  }

  if (novaQuantidade > item.estoque) {
    alert("Quantidade superior ao estoque disponível.");
    return;
  }

  item.quantidade = novaQuantidade;
  salvarCarrinhoLocal();
  renderizarCarrinho();
}

function removerDoCarrinho(produtoId) {
  carrinho = carrinho.filter(item => item.id !== produtoId);
  salvarCarrinhoLocal();
  renderizarCarrinho();
}

function renderizarCarrinho() {
  const container = document.getElementById("carrinho");
  const contador = document.getElementById("cart-count");
  const subtotal = document.getElementById("cart-subtotal");

  const quantidadeTotal = carrinho.reduce(
    (total, item) => total + item.quantidade,
    0
  );

  const valorTotal = carrinho.reduce(
    (total, item) => total + item.preco * item.quantidade,
    0
  );

  if (contador) contador.textContent = quantidadeTotal;
  if (subtotal) subtotal.textContent = moedaBRL.format(valorTotal);

  if (!container) return;

  if (!carrinho.length) {
    container.innerHTML = `
      <div class="empty-cart">
        <i class="bi bi-cart3"></i>
        <strong>Seu carrinho está vazio</strong>
        <p class="mt-2 mb-0">Adicione produtos para continuar.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = carrinho
    .map(
      item => `
        <div class="cart-item">
          <img
            src="${escapeAttr(imagemSegura(item.imagem))}"
            alt="${escapeAttr(item.nome)}"
            class="cart-item-image"
            onerror="this.src='https://placehold.co/160x160/f4f7fb/0b3977?text=JVM'"
          >

          <div>
            <h3>${escapeHTML(item.nome)}</h3>
            <div class="cart-item-price">
              ${moedaBRL.format(item.preco)}
            </div>

            <div class="qty-control">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                data-cart-minus="${escapeAttr(item.id)}"
              >−</button>
              <span>${item.quantidade}</span>
              <button
                type="button"
                aria-label="Aumentar quantidade"
                data-cart-plus="${escapeAttr(item.id)}"
              >+</button>
            </div>
          </div>

          <button
            class="remove-item"
            type="button"
            aria-label="Remover produto"
            title="Remover produto"
            data-cart-remove="${escapeAttr(item.id)}"
          >
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      `
    )
    .join("");
}

async function finalizarCompra() {
  if (!usuarioAtual) {
    abrirLogin();
    return;
  }

  if (!carrinho.length) {
    alert("Seu carrinho está vazio.");
    return;
  }

  const total = carrinho.reduce(
    (soma, item) => soma + item.preco * item.quantidade,
    0
  );

  const itens = carrinho.map(item => ({
    produtoId: item.id,
    nome: item.nome,
    precoUnitario: item.preco,
    quantidade: item.quantidade,
    subtotal: item.preco * item.quantidade
  }));

  try {
    await db.collection("compras").add({
      uid: usuarioAtual.uid,
      email: usuarioAtual.email || "",
      itens,
      total,
      status: "recebido",
      data: firebase.firestore.FieldValue.serverTimestamp()
    });

    carrinho = [];
    salvarCarrinhoLocal();
    renderizarCarrinho();

    const offcanvasElement = document.getElementById("cartOffcanvas");
    if (offcanvasElement) {
      bootstrap.Offcanvas.getOrCreateInstance(offcanvasElement).hide();
    }

    alert("Pedido registrado com sucesso!");
  } catch (error) {
    console.error("Erro ao registrar pedido:", error);
    alert("Não foi possível registrar seu pedido. Tente novamente.");
  }
}

function carregarCarrinhoLocal() {
  try {
    const dados = JSON.parse(localStorage.getItem("jvm-carrinho") || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function salvarCarrinhoLocal() {
  localStorage.setItem("jvm-carrinho", JSON.stringify(carrinho));
}

function obterPrecoVenda(produto) {
  return produto.precoPromocional || produto.preco;
}

function mostrarMensagemProdutos(texto) {
  const el = document.getElementById("mensagem-produtos");
  if (!el) return;
  el.textContent = texto;
  el.classList.remove("d-none");
}

function ocultarMensagemProdutos() {
  document.getElementById("mensagem-produtos")?.classList.add("d-none");
}

function imagemSegura(url) {
  const valor = String(url || "").trim();

  if (/^https?:\/\//i.test(valor)) {
    return valor;
  }

  return "https://placehold.co/600x450/f4f7fb/0b3977?text=JVM+Eletr%C3%B4nicos";
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

function traduzirErroAuth(codigo) {
  const erros = {
    "auth/email-already-in-use": "este e-mail já está cadastrado.",
    "auth/invalid-email": "o e-mail informado é inválido.",
    "auth/weak-password": "a senha é muito fraca.",
    "auth/operation-not-allowed": "o cadastro por e-mail está desativado."
  };

  return erros[codigo] || "verifique os dados informados e tente novamente.";
}
