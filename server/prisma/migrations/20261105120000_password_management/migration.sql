-- Invalida sesiones previas tras cambio o reset de contraseña
ALTER TABLE "users" ADD COLUMN "tokensValidAfter" TIMESTAMP(3);

-- Correos en minúsculas: el login compara sin distinguir mayúsculas
UPDATE "users" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"))
  AND NOT EXISTS (SELECT 1 FROM "users" u2 WHERE u2."email" = lower(trim("users"."email")) AND u2."id" <> "users"."id");
