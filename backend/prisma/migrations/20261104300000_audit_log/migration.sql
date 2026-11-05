-- CreateTable: registro de auditoría (D20). Una fila por cada operación importante: quién, qué y cuándo.
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa en schema.prisma (D20):
-- acción, tipo y resumen no pueden quedar vacíos.
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_action_not_blank" CHECK (length(btrim("action")) > 0);
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_entity_type_not_blank" CHECK (length(btrim("entityType")) > 0);
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_summary_not_blank" CHECK (length(btrim("summary")) > 0);

-- El registro de auditoría solo se agrega: la base rechaza modificar o borrar una fila ya escrita.
CREATE FUNCTION "audit_log_is_append_only"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'AuditLog es de solo agregar: no se puede modificar ni borrar un registro';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_append_only"
    BEFORE UPDATE OR DELETE ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION "audit_log_is_append_only"();
