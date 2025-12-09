import { Product, Movement } from "../types";

const downloadCSV = (content: string, fileName: string) => {
  const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportStockCSV = (products: Product[]) => {
  const header = "Codigo;Produto;Qtd\n";
  const rows = products.map(p => `${p.id};${p.name};${p.qty}`).join("\n");
  downloadCSV(header + rows, `estoque_${new Date().toISOString().slice(0,10)}.csv`);
};

export const exportMovementsCSV = (movements: Movement[]) => {
  const header = "Data;Produto;Qtd;Obs\n";
  const rows = movements.map(m => {
    const date = new Date(m.date).toLocaleDateString();
    return `${date};${m.prodName};${m.qty};${m.obs || ''}`;
  }).join("\n");
  downloadCSV(header + rows, `historico_${new Date().toISOString().slice(0,10)}.csv`);
};
