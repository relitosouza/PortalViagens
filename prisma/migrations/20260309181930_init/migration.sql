-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "cpfBloqueado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Solicitacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomeCompleto" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "dataNascimento" DATETIME NOT NULL,
    "celular" TEXT NOT NULL,
    "emailServidor" TEXT NOT NULL,
    "justificativaPublica" TEXT NOT NULL,
    "nexoCargo" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "dataIda" DATETIME NOT NULL,
    "dataVolta" DATETIME NOT NULL,
    "justificativaLocal" TEXT NOT NULL,
    "fichaOrcamentaria" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Solicitacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitacaoId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "atorRole" TEXT NOT NULL,
    "atorNome" TEXT NOT NULL,
    "decisao" TEXT,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowStep_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prestacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solicitacaoId" TEXT NOT NULL,
    "relatorio" TEXT,
    "prazoFinal" DATETIME NOT NULL,
    "enviadoEm" DATETIME,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Prestacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solicitacaoId" TEXT,
    "prestacaoId" TEXT,
    CONSTRAINT "Anexo_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Anexo_prestacaoId_fkey" FOREIGN KEY ("prestacaoId") REFERENCES "Prestacao" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Prestacao_solicitacaoId_key" ON "Prestacao"("solicitacaoId");
