const { Sequelize } = require('sequelize');
const shortid = require('shortid');

// Import your models
const {
    createAccount,
    createApp,
    createCollaborators,
    createDeployment,
    createPackage,
    createAccessKey,
    createModels,
    MODELS,
} = require('./bin/script/storage/aws-storage'); // Replace with the actual path

// Configure Sequelize connection
const sequelize = new Sequelize('codepushdb', 'codepush', 'root', {
    host: 'db',
    dialect: 'mysql',
});

// Initialize models
createModels(sequelize);  // This will initialize all the models you've defined in the above code

// Define your seed data
const seedData = {
    accounts: [
        { id: 'id_0', email: 'user1@example.com', name: 'User One', tenant_id: 'id_0' },
        { id: 'id_1', email: 'user2@example.com', name: 'User Two', tenant_id: 'id_1' },
    ],
    apps: [
        { id: 'id_2', name: 'App One', tenant_id: 'id_0', accountId: 'id_0' },
        { id: 'id_3', name: 'App Two', tenant_id: 'id_1', accountId: 'id_1' },
    ],
    collaborators: [
        { email: 'user1@example.com', accountId: 'id_0', appId: 'id_2', permission: 'Owner' },
        { email: 'user2@example.com', accountId: 'id_1', appId: 'id_3', permission: 'Owner' },
    ],
    deployments: [
        {
            id: 'id_4',
            name: 'Deployment One',
            key: 'O25dwjupnmTCC-q70qC1CzWfO73NkSR75brivk',
            appId: 'id_2',
            createdTime: new Date(),
            package: {
                appVersion: '1.0',
                blobUrl: 'https://codepush-secondary.blob.core.windows.net/storagev2/z98_ktyhgijjKQai7fIvDj6z_t6pb984637d-14f4-409d-9646-13a0665a3902',
                description: 'Minor improvements',
                isDisabled: false,
                isMandatory: false,
                label: 'v1',
                manifestBlobUrl: 'https://codepush-secondary.blob.core.windows.net/storagev2',
                packageHash: 'd581c94fa2c00b144f1b9a5cf786787826bdf4a9e12e4941c8d2541efc7518ed',
                releasedBy: 'user1@example.com',
                releaseMethod: 'Upload',
                size: 256994,
                uploadTime: 1627990000000,
            },
        },
    ],
    accessKeys: [
        { id: 'id_5', name: 'accessKey1', accountId: 'id_0',createdBy: 'admin', createdTime: new Date().getTime(), friendlyName: 'Default Access Key', expires: 1735689600000 }
    ],
};

// Seed the database and ensure tables are created
async function seedDatabase() {
    try {
        // Sync the models to create the tables in MySQL if they don't exist
        await sequelize.sync({ force: true, engine: 'InnoDB' });  // force: true drops existing tables and recreates them

        console.log('Tables created successfully!');

        // Insert accounts
        for (const account of seedData.accounts) {
            await sequelize.models[MODELS.ACCOUNT].create(account);
        }

        // Insert apps
        for (const app of seedData.apps) {
            await sequelize.models[MODELS.APPS].create(app);
        }

        // Insert collaborators
        for (const collaborator of seedData.collaborators) {
            await sequelize.models[MODELS.COLLABORATOR].create(collaborator);
        }

        // Insert deployments
        for (const deployment of seedData.deployments) {
            const createdDeployment = await sequelize.models[MODELS.DEPLOYMENT].create({
                id: deployment.id,
                name: deployment.name,
                key: deployment.key,
                createdTime: deployment.createdTime,
                appId: deployment.appId,
            });

            // Insert the package for the deployment
            await sequelize.models[MODELS.PACKAGE].create({
                ...deployment.package,
                deploymentId: createdDeployment.id,
            });
        }

        // Insert access keys
        for (const accessKey of seedData.accessKeys) {
            await sequelize.models[MODELS.ACCESSKEY].create(accessKey);
        }

        console.log('Database seeded successfully!');
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await sequelize.close();  // Close the connection once the seeding is done
    }
}

// Run the seed script
seedDatabase();
