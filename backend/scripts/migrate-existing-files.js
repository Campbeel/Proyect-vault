const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateExistingFiles() {
  try {
    console.log('Iniciando migración de archivos existentes...');
    
    // Obtener todos los archivos existentes
    const existingFiles = await prisma.file.findMany();
    console.log(`Encontrados ${existingFiles.length} archivos para migrar`);
    
    for (const file of existingFiles) {
      try {
        // Extraer hash de la URL IPFS
        const hash = file.ipfsUrl.replace('ipfs://', '');
        
        // Actualizar el archivo con los nuevos campos
        await prisma.file.update({
          where: { id: file.id },
          data: {
            pinataHash: hash,
            uploadedAt: file.createdAt // Usar createdAt como uploadedAt por defecto
          }
        });
        
        console.log(`✓ Migrado archivo: ${file.originalName} (${hash})`);
      } catch (error) {
        console.error(`✗ Error migrando archivo ${file.originalName}:`, error.message);
      }
    }
    
    console.log('Migración completada');
  } catch (error) {
    console.error('Error en la migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateExistingFiles(); 