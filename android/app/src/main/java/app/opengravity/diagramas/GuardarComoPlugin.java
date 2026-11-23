package app.opengravity.diagramas;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

// Abre el cuadro "Guardar como" de Android para que el usuario elija carpeta y nombre del archivo.
@CapacitorPlugin(name = "GuardarComo")
public class GuardarComoPlugin extends Plugin {

    @PluginMethod
    public void guardar(PluginCall call) {
        String nombre = call.getString("nombre");
        if (nombre == null || call.getString("datos") == null) {
            call.reject("Faltan el nombre o los datos del archivo");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("tipo", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, nombre);
        startActivityForResult(call, intent, "alElegirLugar");
    }

    @ActivityCallback
    private void alElegirLugar(PluginCall call, ActivityResult resultado) {
        if (call == null) return;
        Intent datosResultado = resultado.getData();
        if (resultado.getResultCode() != Activity.RESULT_OK || datosResultado == null || datosResultado.getData() == null) {
            JSObject respuesta = new JSObject();
            respuesta.put("cancelado", true);
            call.resolve(respuesta);
            return;
        }
        Uri destino = datosResultado.getData();
        try (OutputStream salida = getContext().getContentResolver().openOutputStream(destino, "wt")) {
            if (salida == null) throw new IllegalStateException("Android no abrió el archivo");
            salida.write(Base64.decode(call.getString("datos"), Base64.DEFAULT));
        } catch (Exception e) {
            call.reject("No se pudo escribir el archivo", e);
            return;
        }
        JSObject respuesta = new JSObject();
        respuesta.put("cancelado", false);
        call.resolve(respuesta);
    }
}
