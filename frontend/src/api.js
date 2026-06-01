import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:8000/api' });

export const clientes = {
  list: () => api.get('/clientes/'),
  create: (data) => api.post('/clientes/', data),
  update: (id, data) => api.put(`/clientes/${id}/`, data),
  destroy: (id) => api.delete(`/clientes/${id}/`),
  vehiculos: (id) => api.get(`/clientes/${id}/vehiculos/`),
};

export const vehiculos = {
  list: () => api.get('/vehiculos/'),
  create: (data) => api.post('/vehiculos/', data),
  update: (placa, data) => api.put(`/vehiculos/${placa}/`, data),
  destroy: (placa) => api.delete(`/vehiculos/${placa}/`),
};

export const empleados = {
  list: () => api.get('/empleados/'),
  create: (data) => api.post('/empleados/', data),
  update: (id, data) => api.put(`/empleados/${id}/`, data),
  destroy: (id) => api.delete(`/empleados/${id}/`),
};

export const espacios = {
  list: () => api.get('/espacios/'),
  libres: () => api.get('/espacios/libres/'),
  resumen: () => api.get('/espacios/resumen/'),
  create: (data) => api.post('/espacios/', data),
  update: (id, data) => api.put(`/espacios/${id}/`, data),
  destroy: (id) => api.delete(`/espacios/${id}/`),
};

export const tarifas = {
  list: () => api.get('/tarifas/'),
  create: (data) => api.post('/tarifas/', data),
  update: (id, data) => api.put(`/tarifas/${id}/`, data),
  destroy: (id) => api.delete(`/tarifas/${id}/`),
};

export const tickets = {
  list: () => api.get('/tickets/'),
  activos: () => api.get('/tickets/activos/'),
  create: (data) => api.post('/tickets/', data),
  registrarSalida: (id, data) => api.post(`/tickets/${id}/registrar_salida/`, data),
};

export const pagos = {
  list: () => api.get('/pagos/'),
};

export default api;
