export namespace ConfiguracionSeguridad {
    export const claveJWT = process.env.SECRET_PASSWORD_JWT;
    export const menuUsuarioId = "644718122e9a2f48ab45654b";
    export const listarAccion = "listar"
    export const guardarAccion = "guardar"
    export const editarAccion = "editar"
    export const eliminarAccion = "eliminar"
    export const descargarAccion = "descargar"
    export const mongodbConnectionString = process.env.CONNECTION_STRING_MONGODB;
}