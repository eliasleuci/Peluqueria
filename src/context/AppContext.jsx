import { createContext, useContext, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { supabase, extractFunctionError } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { toDateKey, nowTimeKey } from '../utils/format';
import { evaluarIngreso, elegirFranja } from '../utils/asistencia';
import { normalizarSemana, resumenSemana, franjasDelDia, semanaDePeluquero } from '../utils/horarios';

const AppContext = createContext(null);

const EMPTY_DATA = {
  locales: [],
  servicios: [],
  peluqueros: [],
  productos: [],
  cortes: [],
  ventas: [],
  asistencias: [],
  notificaciones: [],
  config: { metaPeluquero: 0 },
};

// ---- mapeo snake_case (DB) <-> camelCase (JS) ----

const mapLocal = (r) => ({
  id: r.id,
  nombre: r.nombre,
  direccion: r.direccion ?? '',
  telefono: r.telefono ?? '',
  horario: r.horario ?? '',
  horarioSemanal: r.horario_semanal ? normalizarSemana(r.horario_semanal) : null,
  metaMensual: Number(r.meta_mensual) || 0,
  activo: r.activo !== false,
});

const mapServicio = (r) => ({ id: r.id, nombre: r.nombre, precio: Number(r.precio) || 0, activo: r.activo });

const mapPeluquero = (r) => ({
  id: r.id,
  localId: r.local_id,
  nombre: r.nombre,
  comision: Number(r.comision) || 0,
  comisionProducto: Number(r.comision_producto) || 0,
  fechaIngreso: r.fecha_ingreso ?? '',
  horaEntrada: (r.hora_entrada ?? '').slice(0, 5),
  horarioSemanal: r.horario_semanal ? normalizarSemana(r.horario_semanal) : null,
  telefono: r.telefono ?? '',
  email: r.email ?? '',
  authUserId: r.auth_user_id,
  activo: r.activo !== false,
});

const mapAsistencia = (r) => ({
  id: r.id,
  peluqueroId: r.peluquero_id,
  localId: r.local_id,
  fecha: r.fecha,
  horaIngreso: (r.hora_ingreso ?? '').slice(0, 5),
  estado: r.estado,
  minutosTarde: Number(r.minutos_tarde) || 0,
  franja: Number(r.franja) || 1,
  horaEsperada: (r.hora_esperada ?? '').slice(0, 5),
});

const mapNotificacion = (r) => ({
  id: r.id,
  peluqueroId: r.peluquero_id,
  tipo: r.tipo,
  mensaje: r.mensaje,
  leida: r.leida === true,
  createdAt: r.created_at,
});

const mapProducto = (r) => ({
  id: r.id,
  nombre: r.nombre,
  categoria: r.categoria ?? '',
  stock: Number(r.stock) || 0,
  unidad: r.unidad,
  stockMinimo: Number(r.stock_minimo) || 0,
  precio: Number(r.precio) || 0,
  generaComision: r.genera_comision === true,
});

const mapVenta = (r) => ({
  id: r.id,
  localId: r.local_id,
  peluqueroId: r.peluquero_id,
  productoId: r.producto_id,
  cantidad: Number(r.cantidad) || 0,
  precio: Number(r.precio) || 0,
  monto: Number(r.monto) || 0,
  comisionMonto: Number(r.comision_monto) || 0,
  pago: r.pago,
  notas: r.notas ?? '',
  fecha: r.fecha,
  hora: (r.hora ?? '').slice(0, 5),
  createdBy: r.created_by,
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
  const [
    locales,
    servicios,
    servicioPrecios,
    peluqueros,
    productos,
    cortes,
    ventas,
    asistencias,
    notificaciones,
    salonConfig,
  ] = await Promise.all([
    supabase.from('locales').select('*').eq('salon_id', salonId).order('nombre'),
    supabase.from('servicios').select('*').eq('salon_id', salonId).order('nombre'),
    supabase.from('servicio_precios').select('*').eq('salon_id', salonId),
    supabase.from('peluqueros').select('*').eq('salon_id', salonId).order('nombre'),
    supabase.from('productos').select('*').eq('salon_id', salonId).order('nombre'),
    supabase.from('cortes').select('*').eq('salon_id', salonId),
    supabase.from('ventas').select('*').eq('salon_id', salonId),
    supabase.from('asistencias').select('*').eq('salon_id', salonId),
    supabase.from('notificaciones').select('*').eq('salon_id', salonId).order('created_at', { ascending: false }),
    supabase.from('salon_config').select('*').eq('salon_id', salonId).maybeSingle(),
  ]);

  const firstError = [
    locales,
    servicios,
    servicioPrecios,
    peluqueros,
    productos,
    cortes,
    ventas,
    asistencias,
    notificaciones,
    salonConfig,
  ].find((r) => r.error)?.error;
  if (firstError) throw firstError;

  // Adjuntamos a cada servicio sus precios por local: { [localId]: precio }.
  const preciosPorServicio = {};
  for (const row of servicioPrecios.data ?? []) {
    if (!preciosPorServicio[row.servicio_id]) preciosPorServicio[row.servicio_id] = {};
    preciosPorServicio[row.servicio_id][row.local_id] = Number(row.precio) || 0;
  }

  return {
    locales: (locales.data ?? []).map(mapLocal),
    servicios: (servicios.data ?? []).map((s) => ({ ...mapServicio(s), preciosPorLocal: preciosPorServicio[s.id] ?? {} })),
    peluqueros: (peluqueros.data ?? []).map(mapPeluquero),
    productos: (productos.data ?? []).map(mapProducto),
    cortes: (cortes.data ?? []).map(mapCorte),
    ventas: (ventas.data ?? []).map(mapVenta),
    asistencias: (asistencias.data ?? []).map(mapAsistencia),
    notificaciones: (notificaciones.data ?? []).map(mapNotificacion),
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

  // Realtime: cuando otro usuario (p. ej. un peluquero registrando un corte) cambia algo
  // en el salón, refrescamos los datos solos, sin que el dueño tenga que recargar la página.
  // El refetch es silencioso, así que no se pierde ningún modal/drawer abierto.
  useEffect(() => {
    if (!salonId) return;
    let timer;
    const scheduleRefetch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => refetch(), 400);
    };
    const channel = supabase.channel(`salon-${salonId}`);
    for (const table of [
      'cortes',
      'peluqueros',
      'productos',
      'locales',
      'servicios',
      'servicio_precios',
      'ventas',
      'asistencias',
      'notificaciones',
      'salon_config',
    ]) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `salon_id=eq.${salonId}` },
        scheduleRefetch
      );
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [salonId, refetch]);

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
          comision_producto: peluquero.comisionProducto || 0,
          fecha_ingreso: peluquero.fechaIngreso || null,
          hora_entrada: peluquero.horaEntrada || null,
          horario_semanal: peluquero.horarioSemanal ?? null,
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
      if (patch.comisionProducto !== undefined) dbPatch.comision_producto = patch.comisionProducto;
      if (patch.fechaIngreso !== undefined) dbPatch.fecha_ingreso = patch.fechaIngreso || null;
      if (patch.horaEntrada !== undefined) dbPatch.hora_entrada = patch.horaEntrada || null;
      if (patch.horarioSemanal !== undefined) dbPatch.horario_semanal = patch.horarioSemanal;
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
        precio: producto.precio || 0,
        genera_comision: producto.generaComision === true,
      });
      if (error) throw error;
      await refetch();
    },
    [assertSalon, refetch]
  );

  const updateProducto = useCallback(
    async (id, patch) => {
      const dbPatch = {};
      if (patch.nombre !== undefined) dbPatch.nombre = patch.nombre;
      if (patch.categoria !== undefined) dbPatch.categoria = patch.categoria || null;
      if (patch.unidad !== undefined) dbPatch.unidad = patch.unidad;
      if (patch.stockMinimo !== undefined) dbPatch.stock_minimo = patch.stockMinimo;
      if (patch.precio !== undefined) dbPatch.precio = patch.precio;
      if (patch.generaComision !== undefined) dbPatch.genera_comision = patch.generaComision;
      const { error } = await supabase.from('productos').update(dbPatch).eq('id', id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
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

  const addVenta = useCallback(
    async (venta) => {
      assertSalon();
      // El RPC inserta la venta y descuenta el stock de forma atómica y segura.
      const { error } = await supabase.rpc('registrar_venta', {
        p_local_id: venta.localId,
        p_peluquero_id: venta.peluqueroId,
        p_producto_id: venta.productoId,
        p_cantidad: venta.cantidad,
        p_precio: venta.precio,
        p_monto: venta.monto,
        p_comision_monto: venta.comisionMonto || 0,
        p_pago: venta.pago,
        p_notas: venta.notas || '',
        p_fecha: venta.fecha,
        p_hora: venta.hora,
      });
      if (error) throw error;
      await refetch();
    },
    [assertSalon, refetch]
  );

  const deleteVenta = useCallback(
    async (id) => {
      const venta = data.ventas.find((v) => v.id === id);
      const { error } = await supabase.from('ventas').delete().eq('id', id);
      if (error) throw error;
      // Restaura el stock (acción solo del dueño, que tiene permiso sobre productos).
      if (venta) {
        const prod = data.productos.find((p) => p.id === venta.productoId);
        if (prod) {
          const { error: stockErr } = await supabase
            .from('productos')
            .update({ stock: prod.stock + venta.cantidad })
            .eq('id', prod.id);
          if (stockErr) throw stockErr;
        }
      }
      await refetch();
    },
    [data.ventas, data.productos, refetch]
  );

  const addLocal = useCallback(
    async (local) => {
      const salon_id = assertSalon();
      const { error } = await supabase.from('locales').insert({
        salon_id,
        nombre: local.nombre,
        direccion: local.direccion || null,
        telefono: local.telefono || null,
        horario: local.horarioSemanal ? resumenSemana(local.horarioSemanal) : local.horario || null,
        horario_semanal: local.horarioSemanal ?? null,
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
      if (patch.horarioSemanal !== undefined) {
        dbPatch.horario_semanal = patch.horarioSemanal;
        // Texto legible que acompaña al horario estructurado.
        if (patch.horarioSemanal) dbPatch.horario = resumenSemana(patch.horarioSemanal);
      }
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

  const deleteServicio = useCallback(
    async (id) => {
      // Borrado físico. La FK de cortes.servicio_id (sin ON DELETE) hace que la base
      // rechace el borrado si el servicio tiene cortes, protegiendo el historial.
      const { error } = await supabase.from('servicios').delete().eq('id', id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  // Fija (o actualiza) el precio de un servicio en un local puntual.
  const setPrecioServicioLocal = useCallback(
    async (servicioId, localId, precio) => {
      const salon_id = assertSalon();
      const { error } = await supabase
        .from('servicio_precios')
        .upsert(
          { servicio_id: servicioId, local_id: localId, salon_id, precio: Number(precio) || 0 },
          { onConflict: 'servicio_id,local_id' }
        );
      if (error) throw error;
      await refetch();
    },
    [assertSalon, refetch]
  );

  // Quita la excepción => el servicio vuelve a usar el precio base en ese local.
  const quitarPrecioServicioLocal = useCallback(
    async (servicioId, localId) => {
      const { error } = await supabase
        .from('servicio_precios')
        .delete()
        .eq('servicio_id', servicioId)
        .eq('local_id', localId);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  // El peluquero logueado ficha su ingreso. Con horario cortado hay un fichaje por franja:
  // se elige la franja que corresponde a la hora actual y se controla la tardanza contra su
  // inicio (tolerancia 5 min). Si llega tarde, queda un aviso persistente.
  const marcarIngreso = useCallback(async () => {
    const salon_id = assertSalon();
    const peluqueroId = profile?.peluqueroId;
    if (!peluqueroId) throw new Error('Tu usuario no está vinculado a un peluquero.');
    const mio = data.peluqueros.find((p) => p.id === peluqueroId);
    const ahora = new Date();
    const fecha = toDateKey(ahora);
    const horaIngreso = nowTimeKey();

    const franjas = franjasDelDia(semanaDePeluquero(mio, data.locales), ahora);
    const marcadas = data.asistencias
      .filter((a) => a.peluqueroId === peluqueroId && a.fecha === fecha)
      .map((a) => a.franja);
    const eleccion = elegirFranja(franjas, marcadas, horaIngreso);
    if (!eleccion) {
      throw new Error(franjas.length > 1 ? 'Ya marcaste todos tus ingresos de hoy.' : 'Ya marcaste tu ingreso hoy.');
    }
    const horaEsperada = eleccion.franja?.desde ?? null;
    const { estado, minutosTarde } = evaluarIngreso(horaIngreso, horaEsperada);

    const { error } = await supabase.from('asistencias').insert({
      salon_id,
      peluquero_id: peluqueroId,
      local_id: mio?.localId ?? null,
      fecha,
      franja: eleccion.numero,
      hora_esperada: horaEsperada,
      hora_ingreso: horaIngreso,
      estado,
      minutos_tarde: minutosTarde,
      created_by: user?.id,
    });
    if (error) {
      if (error.code === '23505') throw new Error('Ese ingreso ya estaba marcado.');
      throw error;
    }

    if (estado === 'tarde') {
      const turno = franjas.length > 1 ? ` al turno de las ${horaEsperada}` : '';
      await supabase.from('notificaciones').insert({
        salon_id,
        peluquero_id: peluqueroId,
        tipo: 'tardanza',
        mensaje: `Llegaste ${minutosTarde} min tarde${turno} el ${fecha} (ingreso ${horaIngreso}). Podrías perder el presentismo.`,
      });
    }

    await refetch();
    return { estado, minutosTarde, horaIngreso, franja: eleccion.numero, horaEsperada };
  }, [assertSalon, profile, user, data.peluqueros, data.locales, data.asistencias, refetch]);

  const marcarNotificacionLeida = useCallback(
    async (id) => {
      const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
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
      updateProducto,
      deleteProducto,
      ajustarStock,
      addVenta,
      deleteVenta,
      addLocal,
      updateLocal,
      deleteLocal,
      addServicio,
      updateServicio,
      deleteServicio,
      setPrecioServicioLocal,
      quitarPrecioServicioLocal,
      marcarIngreso,
      marcarNotificacionLeida,
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
      updateProducto,
      deleteProducto,
      ajustarStock,
      addVenta,
      deleteVenta,
      addLocal,
      updateLocal,
      deleteLocal,
      addServicio,
      updateServicio,
      deleteServicio,
      setPrecioServicioLocal,
      quitarPrecioServicioLocal,
      marcarIngreso,
      marcarNotificacionLeida,
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
