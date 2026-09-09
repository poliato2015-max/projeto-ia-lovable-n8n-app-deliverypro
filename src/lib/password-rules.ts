/**
 * Regras de senha usadas no cadastro e na redefinição de senha.
 * Texto sempre em português (visível ao usuário).
 * Acompanha a exigência do servidor: mínimo de 6 caracteres.
 */

export const REGRAS_SENHA_TEXTO =
  "A senha deve ter no mínimo 6 caracteres.";

export type ItemRegra = { rotulo: string; ok: boolean };

/** Devolve cada regra e se ela já foi atendida — usado no checklist visual. */
export function checklistSenha(senha: string): ItemRegra[] {
  return [{ rotulo: "Mínimo de 6 caracteres", ok: senha.length >= 6 }];
}

/** Primeira mensagem de erro da senha, ou null quando está tudo certo. */
export function validarSenha(senha: string, confirmacao: string): string | null {
  if (senha.length > 72) {
    return "A senha deve ter no máximo 72 caracteres.";
  }
  if (senha.length < 6) {
    return REGRAS_SENHA_TEXTO;
  }
  if (senha !== confirmacao) {
    return "A senha e a confirmação da senha não são iguais — digite exatamente o mesmo texto nos dois campos.";
  }
  return null;
}

/** Traduz erros de senha devolvidos pelo Supabase. */
export function traduzirErroSenha(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("different from the old password") || m.includes("same_password")) {
    return "Essa senha é igual à sua senha atual. Escolha uma senha diferente das que você já usou.";
  }
  if (m.includes("previously") || m.includes("reuse")) {
    return "Você já usou essa senha antes. Escolha uma senha que nunca tenha sido usada nesta conta.";
  }
  if (m.includes("weak") || m.includes("pwned") || m.includes("leaked")) {
    return "Essa senha é muito comum ou já apareceu em vazamentos. Escolha outra senha.";
  }
  if (m.includes("should be at least") || m.includes("password")) {
    return REGRAS_SENHA_TEXTO;
  }
  return "Não foi possível salvar a senha. Tente novamente.";
}
