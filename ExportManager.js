import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * ExportManager.js
 * Handles exporting bike data to Excel (XML Spreadsheet 2003) format.
 */
const ExportManager = {
    /**
     * Export bike maintenance logs to an Excel file and share it.
     * @param {Object} bike - The bike object containing logs.
     */
    async exportMaintenanceLogs(bike) {
        if (!bike || !bike.logs || bike.logs.length === 0) {
            alert('Nessun record da esportare per questa moto.');
            return;
        }

        try {
            // Sort logs by date (ascending)
            const sortedLogs = [...bike.logs].sort((a, b) => new Date(a.date) - new Date(b.date));

            // 1. Generate XML Spreadsheet 2003 content
            let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="14" ss:Color="#000000" ss:Bold="1"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Bottom"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
   <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sData">
   <Alignment ss:Horizontal="Center" ss:Vertical="Bottom"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Manutenzione">
  <Table ss:ExpandedColumnCount="4">
   <Column ss:AutoFitWidth="0" ss:Width="100"/>
   <Column ss:AutoFitWidth="0" ss:Width="100"/>
   <Column ss:AutoFitWidth="0" ss:Width="150"/>
   <Column ss:AutoFitWidth="0" ss:Width="80"/>
   
   <!-- Titolo: Moto Name merged A1:D2 -->
   <Row ss:Height="25">
    <Cell ss:MergeAcross="3" ss:MergeDown="1" ss:StyleID="sTitle">
     <Data ss:Type="String">${bike.model}</Data>
    </Cell>
   </Row>
   <Row ss:Height="25"/> <!-- Empty row for the MergeDown -->

   <Row ss:Index="4">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Chilometri</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Data</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Tipo Intervento</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Costo (€)</Data></Cell>
   </Row>`;

            sortedLogs.forEach(log => {
                xml += `
   <Row>
    <Cell ss:StyleID="sData"><Data ss:Type="Number">${log.km}</Data></Cell>
    <Cell ss:StyleID="sData"><Data ss:Type="String">${log.date}</Data></Cell>
    <Cell ss:StyleID="sData"><Data ss:Type="String">${log.type}</Data></Cell>
    <Cell ss:StyleID="sData"><Data ss:Type="Number">${log.cost || 0}</Data></Cell>
   </Row>`;
            });

            xml += `
  </Table>
 </Worksheet>
</Workbook>`;

            // 2. Save temporary file (.xls)
            // Note: Even if it's XML, using .xls extension makes Excel open it correctly
            const fileName = `Storico_${bike.model.replace(/\s+/g, '_')}.xls`;

            try {
                await Filesystem.deleteFile({
                    path: fileName,
                    directory: Directory.Cache
                }).catch(() => { });
            } catch (e) { }

            const result = await Filesystem.writeFile({
                path: fileName,
                data: xml,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
            });

            // 3. Share the file
            await Share.share({
                title: `Storico Manutenzione ${bike.model}`,
                text: `Ecco lo storico delle manutenzioni per la mia ${bike.model}.`,
                url: result.uri,
                dialogTitle: 'Invia Storico Manutenzione'
            });

        } catch (error) {
            console.error('Export error:', error);
            alert('Errore durante l\'esportazione: ' + error.message);
        }
    }
};

export default ExportManager;
