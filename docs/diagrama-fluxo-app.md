# Diagrama de fluxo da app (estado atual)

Este documento resume o fluxo funcional atual do **Stockly/StockBackup** para facilitar a evolução para cenários mais complexos (ex.: património, financiamento, aprovações multicamada, circuitos interno/externo).

## 1) Fluxo macro da aplicação

```mermaid
flowchart TD
    A[Utilizador abre app /] --> B{Sessão válida?}
    B -- Não --> C[Login]
    C --> D{IP permitido?}
    D -- Não --> E[Criar pedido de acesso IP]
    E --> F[Admin aprova/rejeita IP]
    F --> C
    D -- Sim --> G[Carregar sessão]
    B -- Sim --> G

    G --> H{Perfil}
    H -- USER --> I[Estado do Pedido + Novo Pedido]
    H -- ADMIN --> J[Painel completo]

    J --> J1[Produtos/Categorias/Fornecedores]
    J --> J2[Requisições GTMI]
    J --> J3[Equipamentos/Unidades QR]
    J --> J4[Storage + Documentos]
    J --> J5[Pessoas + Configuração]
    J --> J6[Insights + Relatórios]
    J --> J7[DB/Admin APIs]

    I --> K[Criar requisição]
    J2 --> K
    K --> L[Validação e criação GTMI]
    L --> M[Reserva/baixa de stock e movimentos]
    M --> N[Notificações + stream realtime]
    N --> O[Fluxo de aprovação/estado]
    O --> P[Assinaturas e levantamento]
    P --> Q[Fecho da requisição]
```

## 2) Fluxo de autenticação e acesso

```mermaid
flowchart LR
    A[POST /api/auth/login] --> B[Validar credenciais]
    B --> C[Validar allowlist de IP]
    C -->|ok| D[Gerar sessão cookie HTTP-only]
    C -->|bloqueado| E[Registar pedido de acesso IP]
    D --> F[GET /api/auth/session]
    F --> G[AuthContext popula user/role]
    G --> H[Render por perfil]
```

## 3) Fluxo de requisição (GTMI) no estado atual

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED: Criar pedido (/api/requests)
    SUBMITTED --> APPROVED: Aprovação
    SUBMITTED --> REJECTED: Rejeição
    APPROVED --> FULFILLED: Entrega/levantamento concluído
    REJECTED --> [*]
    FULFILLED --> [*]
```

> Nota: o enum também contém `DRAFT`, mas a criação principal já entra em `SUBMITTED` no endpoint de criação de requisições.

## 4) Fluxo de pedidos públicos/externos

```mermaid
flowchart TD
    A[Pedido externo recebido] --> B[Status RECEIVED]
    B --> C{Admin analisa}
    C -- Aceita --> D[Status ACCEPTED]
    C -- Rejeita --> E[Status REJECTED]
    D --> F[Notificação + evento realtime]
    E --> F
```

## 5) Módulos já visíveis na navegação

- **Comuns/USER:** Estado do Pedido, Novo Pedido.
- **ADMIN:** Produtos, Requisições, Equipamentos, Storage, DB, Pessoas, Insights, Documentação API, Estado da API.

## 6) Leitura prática para evolução (próximo passo)

Para encaixar novas áreas (património, financiamento, aprovação do presidente, circuito interno/externo), a base atual já permite evoluir por **pipeline de estado**:

1. **Entrada** (pedido interno/externo).
2. **Triagem** (validação documental/serviço requisitante).
3. **Aprovação multicamada** (chefia -> financeiro -> presidência).
4. **Execução** (stock, aquisição, património, contrato).
5. **Fecho e auditoria** (assinaturas, histórico, relatório).

A recomendação é tratar cada nova área como um **subfluxo com estado próprio**, mas ligado ao `Request` principal para manter rastreabilidade ponta-a-ponta.
