import java.util.*;
public class main{
    public static void main(String[] args){
        Scanner sc=new Scanner(System.in);
        System.out.println("How many students?")
        int a=sc.nextInt();
        sc.nextLine();
        ArrayList<String> students=new ArrayList<>();
        for(int i=0;i<a;i++){
            System.out.print("enter student name")
            students.add(sc.nextLine());
        }
        
    }
}