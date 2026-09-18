import { createContext, useContext, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { supabase, extractFunctionError } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);

const EMPTY_DATA = { locales: [], servicios: [], peluqueros: [], productos: [], cortes: [], config: { metaPeluquero: 0 } };

// ---- mapeo snake_case (DB) <-> camelCase (JS) ----

const mapLocal = (r) => ({
  id: r.id,
  nombre: r.nombre,
  direccion: r.direccion ?? '',
  telefono: r.telefono ?? '',
  horario: r.horario ?? '',
  metaMensual: Number(r.meta_mensual) || 0,
  activo: r.activo !== false,
});

const mapServicio = (r) => ({ id: r.id, nombre: r.nombre, precio: Number(r.precio) || 0, activo: r.activo });

const mapPeluquero = (r) => ({
  id: r.id,
  localId: r.local_id,
  nombre: r.nombre,
  comision: Number(r.comision) || 0,
  fechaIngreso: r.fecha_ingreso ?? '',
  telefono: r.telefono ?? '',
  email: r.email ?? '',
  authUserId: r.auth_user_id,
  activo: r.activo !== false,
});

const mapProducto = (r) => ({
  id: r.id,
  nombre: r.nombre,
  categoria: r.categoria ?? '',
  stock: Number(r.stock) || 0,
  unidad: r.unidad,
  stockMinimo: Number(r.stock_minimo) || 0,
});

const mapCorte = (r) => ({
  id: r.id,
  localId: r.local_id,
  peluqueroId: r.peluquero_id,
  servicioId: r.servicio_id,
  fecha: r.fecha,
  hora: (r.hora ?? '').slice(0, 5),
  precio: Number(r.precio) || 0,
  descuento: Number(r.descuento) || 0,
  monto: Number(r.monto) || 0,
  pago: r.pago,
  notas: r.notas ?? '',
  createdBy: r.created_by,
});

async function fetchAll(salonId) {
  const [locales, servicios, peluqueros, productos, cortes, salonConfig] = await Promise.all([
    supabase.from('locales').select('*').eq('salon_id', salonId).order('nombre'),
    supabase.from('servicios').select('*').eq('salon_id', salonId).order('nombre'),
    supabase.from('peluqueros').select('*').eq('salon_id', salonId).order('nombre'),
    supabase.from('productos').select('*').eq('salon_id', salonId).order('nombre'),
    supabase.from('cortes').select('*').eq('salon_id', salonId),
    supabase.from('salon_config').select('*').eq('salon_id', salonId).maybeSingle(),
  ]);

  const firstError = [locales, servicios, peluqueros, productos, cortes, salonConfig].find((r) => r.error)?.error;
  if (firstError) throw firstError;

  return {
    locales: (locales.data ?? []).map(mapLocal),
    servicios: (servicios.data ?? []).map(mapServicio),
    peluqueros: (peluqueros.data ?? []).map(mapPeluquero),
    productos: (productos.data ?? []).map(mapProducto),
    cortes: (cortes.data ?? []).map(mapCorte),
    config: { metaPeluquero: Number(salonConfig.data?.meta_peluquero) || 0 },
  };
}

export function AppProvider({ children }) {
  const { profile, user } = useAuth();
  const salonId = profile?.salonId ?? null;

  const [data, setData] = useState(EMPTY_DATA);
  const [activeLocal, setActiveLocal] = useState('all');
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  // Solo la PRIMERA carga de cada salón muestra la pantalla de "Cargando…" a página completa.
  // Los refetch() disparados por cada guardado son silenciosos: si no, cada alta/edición
  // desmontaría la página entera (perdiendo el modal/drawer abierto) mientras vuelve a pedir los datos.
  const loadedSalonRef = useRef(null);

  const refetch = useCallback(async () => {
    if (!salonId) {
      setData(EMPTY_DATA);
      setLoading(false);
      loadedSalonRef.current = null;
      return;
    }
    const isFirstLoadForThisSalon = loadedSalonRef.current !== salonId;
    if (isFirstLoadForThisSalon) setLoading(true);
    try {
      const fresh = await fetchAll(salonId);
      setData(fresh);
      setDataError(null);
      loadedSalonRef.current = salonId;
    } catch (err) {
      setDataError(err.message ?? String(err));
    } finally {
      if (isFirstLoadForThisSalon) setLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    setActiveLocal('all');
    refetch();
  }, [refetch]);

  const assertSalon = useCallback(() => {
    if (!salonId) throw new Error('No hay salón asociado a este usuario.');
    return salonId;
  }, [salonId]);

  const addCorte = useCallback(
    async (corte) => {
      const salon_id = assertSalon();
      const { error } = await supabase.from('cortes').insert({
        salon_id,
        local_id: corte.localId,
        peluquero_id: corte.peluqueroId,
        servicio_id: corte.servicioId,
        fecha: corte.fecha,
        hora: corte.hora,
        precio: corte.precio,
        descuento: corte.descuento,
        monto: corte.monto,
        pago: corte.pago,
        notas: corte.notas || null,
        created_by: user?.id,
      });
      if (error) throw error;
      await refetch();
    },
    [assertSalon, user, refetch]
  );

  const updateCorte = useCallback(
    async (id, patch) => {
      const dbPatch = {};
      if (patch.notas !== undefined) dbPatch.notas = patch.notas;
      if (patch.precio !== undefined) dbPatch.precio = patch.precio;
      if (patch.descuento !== undefined) dbPatch.descuento = patch.descuento;
      if (patch.monto !== undefined) dbPatch.monto = patch.monto;
      if (patch.pago !== undefined) dbPatch.pago = patch.pago;
      const { error } = await supabase.from('cortes').update(dbPatch).eq('id', id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const deleteCorte = useCallback(
    async (id) => {
      const { error } = await supabase.from('cortes').delete().eq('id', id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const addPeluquero = useCallback(
    async (peluquero) => {
      const salon_id = assertSalon();
      const { data: created, error } = await supabase
        .from('peluqueros')
        .insert({
          salon_id,
          local_id: peluquero.localId,
          nombre: peluquero.nombre,
          comision: peluquero.comision,
          fecha_ingreso: peluquero.fechaIngreso || null,
          telefono: peluquero.telefono || null,
        })
        .select()
        .single();
      if (error) throw error;
      await refetch();
      return mapPeluquero(created);
    },
    [assertSalon, refetch]
  );

  const crearAccesoPeluquero = useCallback(
    async (peluqueroId, email) => {
      const { data, error } = await supabase.functions.invoke('create-peluquero-login', {
        body: { peluqueroId, email },
      });
      if (error) throw new Error(await extractFunctionError(error));
      if (data?.error) throw new Error(data.error);
      await refetch();
      return data; // { email, password }
    },
    [refetch]
  );

  const updatePeluquero = useCallback(
    async (id, patch) => {
      const dbPatch = {};
      if (patch.nombre !== undefined) dbPatch.nombre = patch.nombre;
      if (patch.localId !== undefined) dbPatch.local_id = patch.localId;
      if (patch.comision !== undefined) dbPatch.comision = patch.comision;
      if (patch.fechaIngreso !== undefined) dbPatch.fecha_ingreso = patch.fechaIngreso || null;
      if (patch.telefono !== undefined) dbPatch.telefono = patch.telefono;
      const { error } = await supabase.from('peluqueros').update(dbPatch).eq('id', id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const deletePeluquero = useCallback(
    async (id) => {
      // Baja lógica, no delete físico: un peluquero con cortes cargados no se puede borrar
      // de la tabla sin romper esa referencia — y tampoco queremos perder su historial.
      const { error } = await supabase.from('peluqueros').update({ activo: false }).eq('id', id);
      if (error) throw error;

      // Le corta el login de verdad (además de que RLS ya le bloquea los datos apenas
      // queda activo=false). Si esto falla, la baja lógica ya se aplicó igual — el dato
      // queda protegido por RLS de cualquier forma — pero avisamos del error.
      const { error: fnError } = await supabase.functions.invoke('disable-peluquero-login', {
        body: { peluqueroId: id },
      });
      if (fnError) {
        await refetch();
        throw new Error(`Peluquero dado de baja, pero no se pudo bloquear su login: ${await extractFunctionError(fnError)}`);
      }

      await refetch();
    },
    [refetch]
  );

  const addProducto = useCallback(
    async (producto) => {
      const salon_id = assertSalon();
      const { error } = await supabase.from('productos').insert({
        salon_id,
        nombre: producto.nombre,
        categoria: producto.categoria || null,
        stock: producto.stock,
        unidad: producto.unidad,
        stock_minimo: producto.stockMinimo,
      });
      if (error) throw error;
      await refetch();
    },
    [assertSalon, refetch]
  );

  const deleteProducto = useCallback(
    async (id) => {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const ajustarStock = useCallback(
    async (productoId, delta) => {
      const actual = data.productos.find((p) => p.id === productoId);
      if (!actual) return;
      const nuevoStock = Math.max(0, actual.stock + delta);
      const { error } = await supabase.from('productos').update({ stock: nuevoStock }).eq('id', productoId);
      if (error) throw error;
      await refetch();
    },
    [data.productos, refetch]
  );

  const addLocal = useCallback(
    async (local) => {
      const salon_id = assertSalon();
      const { error } = await supabase.from('locales').insert({
        salon_id,
        nombre: local.nombre,
        direccion: local.direccion || null,
        telefono: local.telefono || null,
        horario: local.horario || null,
        meta_mensual: local.metaMensual || 0,
      });
      if (error) throw error;
      await refetch();
    },
    [assertSalon, refetch]
  );

  const updateLocal = useCallback(
    async (id, patch) => {
      const dbPatch = {};
      if (patch.nombre !== undefined) dbPatch.nombre = patch.nombre;
      if (patch.direccion !== undefined) dbPatch.direccion = patch.direccion;
      if (patch.telefono !== undefined) dbPatch.telefono = patch.telefono;
      if (patch.horario !== undefined) dbPatch.horario = patch.horario;
      if (patch.metaMensual !== undefined) dbPatch.meta_mensual = patch.metaMensual;
      const { error } = await supabase.from('locales').update(dbPatch).eq('id', id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const deleteLocal = useCallback(
    async (id) => {
      // Baja lógica, no delete físico: un local con peluqueros/cortes/productos cargados
      // no se puede borrar sin romper esa referencia.
      const { error } = await supabase.from('locales').update({ activo: false }).eq('id', id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const addServicio = useCallback(
    async (servicio) => {
      const salon_id = assertSalon();
      const { error } = await supabase.from('servicios').insert({
        salon_id,
        nombre: servicio.nombre,
        precio: servicio.precio,
        activo: true,
      });
      if (error) throw error;
      await refetch();
    },
    [assertSalon, refetch]
  );

  const updateServicio = useCallback(
    async (id, patch) => {
      const dbPatch = {};
      if (patch.nombre !== undefined) dbPatch.nombre = patch.nombre;
      if (patch.precio !== undefined) dbPatch.precio = patch.precio;
      if (patch.activo !== undefined) dbPatch.activo = patch.activo;
      const { error } = await supabase.from('servicios').update(dbPatch).eq('id', id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const updateConfig = useCallback(
    async (patch) => {
      const salon_id = assertSalon();
      const dbPatch = { salon_id };
      if (patch.metaPeluquero !== undefined) dbPatch.meta_peluquero = patch.metaPeluquero;
      const { error } = await supabase.from('salon_config').upsert(dbPatch, { onConflict: 'salon_id' });
      if (error) throw error;
      await refetch();
    },
    [assertSalon, refetch]
  );

  const limpiarDemo = useCallback(async () => {
    const salon_id = assertSalon();
    const { error } = await supabase.from('cortes').delete().eq('salon_id', salon_id);
    if (error) throw error;
    await refetch();
  }, [assertSalon, refetch]);

  const value = useMemo(
    () => ({
      data,
      loading,
      dataError,
      activeLocal,
      setActiveLocal,
      refetch,
      addCorte,
      updateCorte,
      deleteCorte,
      addPeluquero,
      crearAccesoPeluquero,
      updatePeluquero,
      deletePeluquero,
      addProducto,
      deleteProducto,
      ajustarStock,
      addLocal,
      updateLocal,
      deleteLocal,
      addServicio,
      updateServicio,
      updateConfig,
      limpiarDemo,
    }),
    [
      data,
      loading,
      dataError,
      activeLocal,
      refetch,
      addCorte,
      updateCorte,
      deleteCorte,
      addPeluquero,
      updatePeluquero,
      crearAccesoPeluquero,
      deletePeluquero,
      addProducto,
      deleteProducto,
      ajustarStock,
      addLocal,
      updateLocal,
      deleteLocal,
      addServicio,
      updateServicio,
      updateConfig,
      limpiarDemo,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
