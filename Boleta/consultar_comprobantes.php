<?php


/*

FEAFIP_SDK Factura electrónica AFIP

Para soporte:
contacto@bitingenieria.com.ar

*/



$fc = new stdClass();

$fc->cuit = 20939802593;
$fc->pto_vta = 120;
$fc->tipo_comp = 1;
$fc->nro_inicial = 722;
$fc->nro_final = 728;

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL,            "https://api.bitingenieria.com.ar/silex/feafip/fe_cmp_consultar" );
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1 );
curl_setopt($ch, CURLOPT_POST,           1 );
curl_setopt($ch, CURLOPT_HEADER,         0 );
curl_setopt($ch, CURLOPT_POSTFIELDS,     json_encode($fc));

try {
    $result = curl_exec($ch);

    // Respuesta de AFIP como objeto
    $resultObj = json_decode($result);


    // Muestra el json con la respuesta de AFIP (CAE, Vencimiento, PDF en formato Base64)
    echo $result;

    // Muestra el PDF
    //header('Content-Type: application/pdf');
    //echo base64_decode($resultObj->pdf);

} catch (Exception $e) {
    echo $e->getMessage();
}







