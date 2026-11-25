-- Schema SQL oficial da plataforma ELO+ baseado no DER do projeto (Fatec Zona Sul - ADS 2026)
-- Compativel com MySQL 8+ e H2 (MODE=MySQL)

CREATE TABLE IF NOT EXISTS enderecos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_casa INT NULL,
    logradouro VARCHAR(60) NOT NULL,
    bairro VARCHAR(45) NOT NULL,
    distrito VARCHAR(30) NULL,
    municipio VARCHAR(45) NOT NULL,
    estado VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cpf VARCHAR(14) NULL UNIQUE,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    telefone VARCHAR(20) NULL,
    senha VARCHAR(255) NOT NULL,
    data_nascimento DATE NULL,
    endereco_id INT NULL,
    CONSTRAINT fk_usuarios_endereco FOREIGN KEY (endereco_id) REFERENCES enderecos(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS perfils (
    id INT AUTO_INCREMENT PRIMARY KEY,
    visibilidade TINYINT(1) NOT NULL DEFAULT 1,
    avatar TEXT NULL,
    biografia VARCHAR(500) NULL,
    banner TEXT NULL,
    headline VARCHAR(120) NULL,
    habilidades_desejadas VARCHAR(500) NULL,
    usuario_id INT NOT NULL UNIQUE,
    CONSTRAINT fk_perfils_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS habilidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(60) NOT NULL,
    categoria VARCHAR(45) NOT NULL,
    nivel VARCHAR(30) NOT NULL DEFAULT 'Intermediário',
    modalidade VARCHAR(40) NOT NULL DEFAULT 'Presencial e Remoto',
    descricao VARCHAR(225) NULL
);

CREATE TABLE IF NOT EXISTS lista_habilidades (
    perfils_id INT NOT NULL,
    habilidade_id INT NOT NULL,
    data_adicao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ativa TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (perfils_id, habilidade_id),
    CONSTRAINT fk_lista_perfil FOREIGN KEY (perfils_id) REFERENCES perfils(id) ON DELETE CASCADE,
    CONSTRAINT fk_lista_habilidade FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trocas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_inicio DATETIME NOT NULL,
    data_final DATETIME NULL,
    status TINYINT NOT NULL DEFAULT 0, -- 0=PENDENTE, 1=CONFIRMADA, 2=EM_ANDAMENTO, 3=CONCLUIDA, 4=CANCELADA, 5=CONTRAPROPOSTA
    habilidade_ofertada VARCHAR(100) NOT NULL,
    habilidade_solicitada VARCHAR(100) NOT NULL,
    modalidade VARCHAR(20) NOT NULL DEFAULT 'Presencial',
    local_encontro VARCHAR(160) NOT NULL,
    observacoes VARCHAR(320) NULL
);

CREATE TABLE IF NOT EXISTS trocas_usuarios (
    troca_id INT NOT NULL,
    usuario_id INT NOT NULL,
    papel VARCHAR(20) NOT NULL DEFAULT 'PARTICIPANTE', -- PROPONENTE | RECEPTOR
    PRIMARY KEY (troca_id, usuario_id),
    CONSTRAINT fk_tu_troca FOREIGN KEY (troca_id) REFERENCES trocas(id) ON DELETE CASCADE,
    CONSTRAINT fk_tu_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS avaliacao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    pontuacao TINYINT NOT NULL,
    data DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    troca_id INT NOT NULL,
    avaliador_id INT NULL,
    CONSTRAINT fk_avaliacao_troca FOREIGN KEY (troca_id) REFERENCES trocas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status TINYINT NOT NULL DEFAULT 1, -- 0=ENCERRADO, 1=ATIVO, 2=ARQUIVADO
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_usuarios (
    usuario_id INT NOT NULL,
    chat_id INT NOT NULL,
    PRIMARY KEY (usuario_id, chat_id),
    CONSTRAINT fk_cu_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_cu_chat FOREIGN KEY (chat_id) REFERENCES chat(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mensagem (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conteudo VARCHAR(600) NOT NULL,
    data_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_recebimento DATETIME NULL,
    status TINYINT NOT NULL DEFAULT 0, -- 0=ENVIADO, 1=ENTREGUE, 2=VISUALIZADO
    chat_id INT NOT NULL,
    remetente_id INT NULL,
    CONSTRAINT fk_mensagem_chat FOREIGN KEY (chat_id) REFERENCES chat(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notificacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(80) NOT NULL,
    conteudo VARCHAR(255) NOT NULL,
    visualizacao TINYINT(1) NOT NULL DEFAULT 0,
    data DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo TINYINT NOT NULL DEFAULT 0, -- 0=PROPOSTA_TROCA, 1=MENSAGEM_CHAT, 2=AGENDAMENTO, 3=INTERACAO_AVALIACAO, 4=RECEBIMENTO_AVALIACAO
    perfil_id INT NOT NULL,
    CONSTRAINT fk_notificacoes_perfil FOREIGN KEY (perfil_id) REFERENCES perfils(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS preferencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    distancia_maxima DOUBLE NOT NULL DEFAULT 25.0,
    idioma VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    modo_escuro TINYINT(1) NOT NULL DEFAULT 0,
    mostrar_email TINYINT(1) NOT NULL DEFAULT 1,
    permitir_mensagens TINYINT(1) NOT NULL DEFAULT 1,
    perfil_id INT NOT NULL UNIQUE,
    CONSTRAINT fk_preferencias_perfil FOREIGN KEY (perfil_id) REFERENCES perfils(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS preferencia_notificoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proposta_troca TINYINT(1) NOT NULL DEFAULT 1,
    mensagem_chat TINYINT(1) NOT NULL DEFAULT 1,
    lembrete_agendamento TINYINT(1) NOT NULL DEFAULT 1,
    interacao_avaliacao TINYINT(1) NOT NULL DEFAULT 1,
    recebimento_avaliacao TINYINT(1) NOT NULL DEFAULT 1,
    email_ativo TINYINT(1) NOT NULL DEFAULT 1,
    push_ativo TINYINT(1) NOT NULL DEFAULT 1,
    preferencia_id INT NOT NULL UNIQUE,
    CONSTRAINT fk_pref_notif_pref FOREIGN KEY (preferencia_id) REFERENCES preferencias(id) ON DELETE CASCADE
);
