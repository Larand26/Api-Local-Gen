abstract class Utils {
  static formatDateToSql(date: Date): string {
    // Formata a data para o formato 'YYYY-MM-DD' usado em SQL Server
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

export default Utils;
