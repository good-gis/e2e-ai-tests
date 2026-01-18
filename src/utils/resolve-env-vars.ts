/**
 * Подставляет значения переменных окружения в строку.
 * Заменяет плейсхолдеры вида ${VAR_NAME} на значения из process.env.
 * Если переменная не найдена, подставляется пустая строка.
 *
 * @param value - Строка с плейсхолдерами переменных окружения
 * @returns Строка с подставленными значениями
 *
 * @example
 * // process.env.API_KEY = "secret123"
 * resolveEnvVars("Bearer ${API_KEY}") // → "Bearer secret123"
 */
export function resolveEnvVars(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
        return process.env[envVar] || '';
    });
}