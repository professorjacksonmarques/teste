
let usuarioAtual = null;

auth.onAuthStateChanged(user => {
  if (!user) return window.location.href = "index.html";
  usuarioAtual = user;

  db.collection("usuarios").doc(user.uid).get().then(doc => {
    if (!doc.exists || doc.data().perfil !== "admin") {
      alert("Acesso negado.");
      window.location.href = "index.html";
    } else {
      carregarProdutos();
      carregarUsuarios();
    }
  });
});

function alternarEntradaImagem() {
  const tipo = document.getElementById("tipoImagem").value;
  document.getElementById("imagemURL").classList.toggle("d-none", tipo !== "url");
  document.getElementById("imagemArquivo").classList.toggle("d-none", tipo !== "arquivo");
}

function carregarProdutos() {
  db.collection("produtos").get().then(snapshot => {
    let html = "";
    snapshot.forEach(doc => {
      const p = doc.data();
      html += `
        <div class="col-md-4 mb-3">
          <div class="card">
            <img src="${p.imagem}" class="card-img-top">
            <div class="card-body">
              <h5 class="card-title">${p.nome}</h5>
              <p class="card-text">Preço: R$ ${p.preco.toFixed(2)}</p>
              <p class="card-text">Estoque: ${p.estoque}</p>
              <button class="btn btn-sm btn-warning me-2" onclick="editarProduto('${doc.id}', '${p.nome}', ${p.preco}, ${p.estoque}, '${p.imagem}')">Editar</button>
              <button class="btn btn-sm btn-danger" onclick="excluirProduto('${doc.id}')">Excluir</button>
            </div>
          </div>
        </div>
      `;
    });
    document.getElementById("lista-produtos").innerHTML = html;
    mostrarMensagem("Produtos carregados com sucesso.", "info");
  }).catch(error => {
    console.error("Erro ao carregar produtos:", error);
    mostrarMensagem("Erro ao carregar produtos.", "danger");
  });
}

function mostrarFormulario() {
  document.getElementById("form-produto").classList.remove("d-none");
  document.getElementById("id-produto").value = "";
  document.getElementById("nome").value = "";
  document.getElementById("preco").value = "";
  document.getElementById("estoque").value = "";
  document.getElementById("imagemURL").value = "";
  document.getElementById("imagemArquivo").value = "";
  document.getElementById("tipoImagem").value = "url";
  alternarEntradaImagem();
}

function cancelarFormulario() {
  document.getElementById("form-produto").classList.add("d-none");
}

function salvarProduto() {
  const id = document.getElementById("id-produto").value;
  const nome = document.getElementById("nome").value;
  const preco = parseFloat(document.getElementById("preco").value);
  const estoque = parseInt(document.getElementById("estoque").value);
  const tipoImagem = document.getElementById("tipoImagem").value;
  const imagemURL = document.getElementById("imagemURL").value;
  const imagemArquivo = document.getElementById("imagemArquivo").files[0];

  if (!nome || isNaN(preco) || isNaN(estoque)) {
    alert("Preencha corretamente nome, preço e estoque.");
    return;
  }

  if (tipoImagem === "url" && imagemURL) {
    const dados = { nome, preco, estoque, imagem: imagemURL };
    salvarOuAtualizar(id, dados);
  } else if (tipoImagem === "arquivo" && imagemArquivo) {
    const storageRef = storage.ref('produtos/' + imagemArquivo.name);
    storageRef.put(imagemArquivo).then(snapshot => {
      snapshot.ref.getDownloadURL().then(url => {
        const dados = { nome, preco, estoque, imagem: url };
        salvarOuAtualizar(id, dados);
      });
    });
  } else {
    alert("Selecione um tipo de imagem válido e preencha o campo corretamente.");
  }
}

function salvarOuAtualizar(id, dados) {
  if (id) {
    db.collection("produtos").doc(id).update(dados).then(() => {
      mostrarMensagem("Produto atualizado com sucesso!", "success");
      cancelarFormulario();
      carregarProdutos();
    });
  } else {
    db.collection("produtos").add(dados).then(() => {
      mostrarMensagem("Produto adicionado com sucesso!", "success");
      cancelarFormulario();
      carregarProdutos();
    });
  }
}

function editarProduto(id, nome, preco, estoque, imagem) {
  document.getElementById("form-produto").classList.remove("d-none");
  document.getElementById("id-produto").value = id;
  document.getElementById("nome").value = nome;
  document.getElementById("preco").value = preco;
  document.getElementById("estoque").value = estoque;
  document.getElementById("imagemURL").value = imagem;
  document.getElementById("tipoImagem").value = "url";
  alternarEntradaImagem();
}

function excluirProduto(id) {
  if (confirm("Deseja excluir este produto?")) {
    db.collection("produtos").doc(id).delete().then(() => {
      mostrarMensagem("Produto excluído com sucesso!", "danger");
      carregarProdutos();
    });
  }
}

function mostrarMensagem(texto, tipo) {
  const el = document.getElementById("mensagem");
  el.className = "alert alert-" + tipo;
  el.textContent = texto;
  el.classList.remove("d-none");
  setTimeout(() => el.classList.add("d-none"), 3000);
}

// Gerenciar usuários
function carregarUsuarios() {
  db.collection("usuarios").get().then(snapshot => {
    let html = "";
    snapshot.forEach(doc => {
      const u = doc.data();
      const email = u.email || "Email não disponível";
      const isAdmin = u.perfil === "admin";
      html += `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          ${email}
          ${isAdmin ? '<span class="badge bg-success">Admin</span>' :
          `<button class="btn btn-sm btn-outline-success" onclick="promover('${doc.id}')">Tornar Admin</button>`}
        </li>
      `;
    });
    document.getElementById("lista-usuarios").innerHTML = html;
  }).catch(err => {
    console.error("Erro ao carregar usuários:", err);
  });
}

function promover(uid) {
  db.collection("usuarios").doc(uid).update({ perfil: "admin" }).then(() => {
    mostrarMensagem("Usuário promovido a admin.", "success");
    carregarUsuarios();
  }).catch(err => {
    console.error("Erro ao promover usuário:", err);
  });
}
