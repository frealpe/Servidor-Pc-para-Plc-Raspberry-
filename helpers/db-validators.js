const Role = require('../models/role');
const Usuario = require('../models/usuario');
const esRoleVaido = async (rol = '') => {
    //Verifcar si existe el rol    
    const existeRol = await Role.findOne({ rol });
    if (!existeRol) {
        throw new Error(`El rol ${rol} no esta registrado`)
    }

}

/////////////////////////////////////////////////////////////////
const emailExiste = async (correo = '') => {
    //Verifcar si existe el correo
    const existeEmail = await Usuario.findOne({ correo });
    if (existeEmail) {
        throw new Error(`El correo: ${correo} ya esta registrado`);

    }

}

/////////////////////////////////////////////////////////////////
const existeUsuarioPorId = async (id) => {
    //Verifcar si existe el correo
    const existeUsuario = await Usuario.findById(id);
    if (!existeUsuario) {
        throw new Error(`El id no existe: ${id}`);

    }
}
/////////////////////////////////////////////////////////////////
module.exports = {
    esRoleVaido,
    emailExiste,
    existeUsuarioPorId,
}