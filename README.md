# ELO+ — Plataforma Digital de Economia Colaborativa

<p align="center">
  <strong>Troque habilidades e serviços com outras pessoas sem precisar usar dinheiro.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Ionic_React-9-3880FF?style=for-the-badge&logo=ionic&logoColor=white" alt="Ionic React 9" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Spring_Boot-3.3.5-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot" />
  <img src="https://img.shields.io/badge/GitHub_Pages-Deploy_Autom%C3%A1tico-222222?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Pages" />
</p>

---

## Sobre o Projeto

O **ELO+** é uma aplicação web e mobile responsiva desenvolvida como projeto acadêmico para a **Faculdade de Tecnologia do Estado de São Paulo (Fatec Zona Sul — Dom Paulo Evaristo Arns)** no curso de **Análise e Desenvolvimento de Sistemas (2026)**.

A plataforma resolve o problema de acesso a mentorias, aulas, serviços técnicos e criativos por meio da **economia colaborativa**: cada participante cadastra suas competências e descobre outros membros dispostos a realizar **trocas diretas de habilidades** (presenciais ou remotas), negociando datas, locais e termos em tempo real.

---

## Principais Funcionalidades

- **Autenticação na Nuvem + Modo Demonstração**:
  - **Login com Google** e **Cadastro/Login com E-mail e Senha** via **Firebase Authentication** (com verificação de e-mail e recuperação de senha).
  - **Conta Demonstração** (*Juan Silva*) para exploração instantânea sem necessidade de cadastro.
- **Descoberta de Talentos e Filtro Real vs. Exemplo**:
  - Listagem em tempo real de membros cadastrados na nuvem (`Membro real`) separados claramente dos perfis ilustrativos (`Exemplo`), com filtro rápido **Todos / Membros reais**, busca textual, filtro por categoria e modalidade (**Presencial** ou **Remoto**).
- **Chat em Tempo Real entre Usuários**:
  - Conversas sincronizadas instantaneamente via **Cloud Firestore (`onSnapshot`)**, com contagem de mensagens não lidas e atalho direto **Propor troca** no cabeçalho da conversa.
- **Negociação e Agendamento de Trocas**:
  - Fluxo completo de propostas (`PENDENTE` → `CONTRAPROPOSTA` → `CONFIRMADA` → `CONCLUIDA` ou `CANCELADA`), notificações e sistema de avaliação após a conclusão.
- **Gestão Completa de Perfil**:
  - Edição direta de informações pessoais (nome, especialidade, bairro/cidade, bio), upload otimizado de avatar e capa, habilidades ofertadas, interesses desejados e portfólio em destaque.
- **Interface Responsiva e Acessível**:
  - Rail de navegação lateral no desktop e barra inferior nativa (`IonTabBar`) em dispositivos móveis, além de suporte a **Modo Escuro**.

---

## Tecnologias Utilizadas

| Camada | Tecnologias |
| :--- | :--- |
| **Frontend Web / Mobile** | **React 19**, **Ionic React 9** (`@ionic/react` + `ionicons`), **TypeScript**, **Tailwind CSS v4**, **Vite** |
| **Nuvem & Tempo Real** | **Firebase Authentication** (Google OAuth & E-mail/Senha) e **Cloud Firestore** (`onSnapshot`, transações em lote `writeBatch` e regras de segurança `firestore.rules`) |
| **Backend Alternativo (Local/API)** | **Java 21 + Spring Boot 3.3.5** (`backend-spring-boot/`) com Spring Data JPA, BCrypt e suporte a **MySQL 8+ / H2**; servidor **Express + TypeScript** (`server.ts`) para desenvolvimento local |
| **Segurança & Qualidade** | `@firebase/eslint-plugin-security-rules`, testes unitários com `node:test` via `tsx` (`validation.test.ts`, `userDirectory.test.ts`, `localRuntime.test.ts`, `firestore.rules.test.ts`) |
| **CI/CD & Hospedagem** | **GitHub Actions** (`.github/workflows/deploy-pages.yml`) com publicação automática no **GitHub Pages** |

---

## Estrutura do Projeto

```text
├── .github/workflows/deploy-pages.yml  # Pipeline de build e publicação no GitHub Pages
├── backend-spring-boot/                # API alternativa em Java 21 + Spring Boot + schema.sql
├── server/                             # Módulos do servidor local Express (auth & store)
├── src/
│   ├── components/                     # Views e modais (AuthViews, HomeView, ExploreView, MessagesView, ExchangesView, ProfileView, SettingsView, CreatorModal)
│   ├── services/                       # Integrações (firebaseRuntime.ts, localRuntime.ts, api.ts)
│   ├── shared/                         # Tipos, validações, regras de diretório e contratos Firebase
│   ├── firebase.ts                     # Inicialização do Firebase App, Auth e Firestore
│   └── App.tsx                         # Roteamento de abas e sincronização de sessão em tempo real
├── firebase-applet-config.json         # Configuração pública do projeto Firebase
├── firebase-blueprint.json             # Especificação das coleções e limites do Firestore
├── firestore.rules                     # Regras de segurança implantadas no Firestore
└── server.ts                           # Servidor Express integrado ao Vite para ambiente local
```

---

## Como Executar

### 1. Pré-requisitos
- **Node.js 20+** (`npm`)
- *(Opcional, apenas para o backend Java)* **Java JDK 21**, **Maven 3.9+** e **MySQL 8+**

### 2. Rodar localmente (Frontend + Express)
```bash
git clone https://github.com/j0natasC/Eloplus.git
cd Eloplus
npm install --legacy-peer-deps
npm run dev
```
Acesse **`http://localhost:3000`**.

### 3. Rodar com Backend Java Spring Boot *(opcional)*
```bash
cd backend-spring-boot
mvn spring-boot:run
```
Na raiz do projeto, crie um `.env.local` com `VITE_API_URL=http://localhost:8080` e inicie o Vite (`npx vite --port 5173`).

### 4. Publicação no GitHub Pages + Firebase
1. No repositório do GitHub, acesse **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**.
2. No **Firebase Console**:
   - Em **Authentication → Settings → Authorized domains**, adicione o domínio do GitHub Pages (ex.: `seu-usuario.github.io`).
   - Em **Authentication → Sign-in method**, mantenha **Google** e **E-mail/senha** ativados para que qualquer usuário possa se cadastrar e sincronizar em tempo real.

---

## Testes Automatizados

Execute a suíte de testes unitários (regras do Firestore, validações, diretório de membros e runtime local) com:

```bash
npx tsx --test src/shared/validation.test.ts src/shared/userDirectory.test.ts src/services/localRuntime.test.ts firestore.rules.test.ts
```

Para validar tipos e geração do build de produção:
```bash
npm run lint
npm run build
```

---

## Contexto Acadêmico

Desenvolvido para a disciplina de projeto integrador / engenharia de software — **Fatec Zona Sul (Dom Paulo Evaristo Arns)**, 2026.
