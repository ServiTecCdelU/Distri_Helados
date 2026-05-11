<?php


/*

FEAFIP_SDK Factura electrónica AFIP

Para soporte:
contacto@bitingenieria.com.ar

*/



$fc = new stdClass();

$fc->tipo_comp = 1;
$fc->pto_vta = 140;
$fc->date = date('d/m/Y');
$fc->can_mis_mon_ext = 'N';

$fc->company_data = new stdClass();
$fc->company_data->name = "Bit Ingeniería";
$fc->company_data->address = "Italia 945";
$fc->company_data->postal_code = "1708";
$fc->company_data->city = "Castelar";
$fc->company_data->phone = "+54(11)-20923168";
$fc->company_data->fax = "011-1569375707";
$fc->company_data->ident = "20-93980259-3";
$fc->company_data->email = "contacto@bitingenieria.com.ar";
$fc->company_data->web = "https://www.bitingenieria.com.ar";

$fc->customer_data = new stdClass();
$fc->customer_data->name = "Nombre Cliente";
$fc->customer_data->address = "Dirección del cliente";
$fc->customer_data->postal_code = "31659";
$fc->customer_data->city = "Buenos Aires";
$fc->customer_data->country = "Argentina";
$fc->customer_data->ident = "27-92900786-2";
$fc->customer_data->doc_type = 80;
$fc->customer_data->condicion_iva_receptor_id = 1;


$product = new stdClass();
//"type": "P",
$product->description = "Producto nro 10";
$product->price = 1025.95;
$product->quantity = 1;
$product->sum_price = 1025.95;
$product->sum_tax = 205.19;
$product->discount = 0;
$product->total = 1452.73;

$fc->products[] = $product;

$fc->base = new stdClass();
$fc->base->subtotal = 1200.60;
$fc->base->sum_tax = 252.13;
$fc->base->discount = 0;
$fc->base->total = 1452.73;

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL,            "http://api.bitingenieria.com.ar/silex/feafip/fe_autorizar" );
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1 );
curl_setopt($ch, CURLOPT_POST,           1 );
curl_setopt($ch, CURLOPT_HEADER,         0 );
curl_setopt($ch, CURLOPT_POSTFIELDS,     json_encode($fc));

try {
    $result = curl_exec($ch);

    // Respuesta de AFIP como objeto
    $resultObj = json_decode($result);

    if ($resultObj->sucess) {
        file_put_contents('factura.pdf', base64_decode($resultObj->pdf));
        $resultObj->pdflink = 'http://localhost'. str_replace('obtener_cae.php', 'factura.pdf', $_SERVER['REQUEST_URI']);
        echo json_encode($resultObj);
    } else
        echo $resultObj->description;
    // Muestra el json con la respuesta de AFIP (CAE, Vencimiento, PDF en formato Base64)

    // Muestra el PDF
    //header('Content-Type: application/pdf');
    //echo base64_decode($resultObj->pdf);

} catch (Exception $e) {
    echo $e->getMessage();
}







