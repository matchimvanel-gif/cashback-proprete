const sdk = require("node-appwrite");

module.exports = async function (req, res) {
  const client = new sdk.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new sdk.Databases(client);

  try {
    const maintenant = new Date();
    const trenteJoursAvant = new Date(
      maintenant.getTime() - 30 * 24 * 60 * 60 * 1000,
    );

    const etablissements = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID,
      "etablissements",
    );

    let updatedCount = 0;

    for (const etab of etablissements.documents) {
      const dateRenouvellement = new Date(etab.dateRenouvellement || 0);

      if (dateRenouvellement <= trenteJoursAvant) {
        const nouvelleDate = new Date(
          maintenant.getTime() + 30 * 24 * 60 * 60 * 1000,
        );

        await databases.updateDocument(
          process.env.APPWRITE_DATABASE_ID,
          "etablissements",
          etab.$id,
          {
            montantContrat: 25000,
            dateRenouvellement: nouvelleDate.toISOString(),
            updatedAt: maintenant.toISOString(),
          },
        );

        updatedCount++;
      }
    }

    res.json({
      success: true,
      updatedCount: updatedCount,
      message: `${updatedCount} contrats ont été renouvelés.`,
    });
  } catch (error) {
    console.error(error);
    res.json(
      {
        success: false,
        error: error.message,
      },
      500,
    );
  }
};
